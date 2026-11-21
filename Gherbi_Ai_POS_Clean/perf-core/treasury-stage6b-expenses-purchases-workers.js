/**
 * perf-core/treasury-stage6b-expenses-purchases-workers.js
 * الشطر 6-ب: تعميم مصفوفة مصادر التمويل الأربعة وقفل الوردية على المصاريف وسلفة العمال والصندوق والمشتريات
 */
'use strict';
(function buildStage6BUnifiedFundingModule() {
  (function initWarStage6BUnifiedFunding() {
    'use strict';

    if (window.GherbiTreasuryStage6B && window.GherbiTreasuryStage6B._installed) return;

    function fmtDzd(v) {
      return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    }

    function setAlert(elId, msg, level) {
      const box = document.getElementById(elId);
      if (!box) return;
      if (!msg) {
        box.classList.add('hidden');
        box.textContent = '';
        return;
      }
      box.classList.remove('hidden', 'bg-rose-500/10', 'border-rose-500/40', 'text-rose-600', 'bg-amber-500/10', 'border-amber-500/40', 'text-amber-700');
      if (level === 'warning') box.classList.add('bg-amber-500/10', 'border-amber-500/40', 'text-amber-700');
      else box.classList.add('bg-rose-500/10', 'border-rose-500/40', 'text-rose-600');
      box.textContent = msg;
    }

    const Stage6B = {
      _installed: true,
      version: '6B.0.0-unified-4source-funding',
      _trStatus: null,

      async fetchStatus() {
        const uid = window.AppState?.currentUser?.id || null;
        if (window.GherbiTreasuryStage6A && typeof window.GherbiTreasuryStage6A.loadTreasuryStatus === 'function') {
          this._trStatus = await window.GherbiTreasuryStage6A.loadTreasuryStatus();
          return this._trStatus;
        }
        try {
          if (window.api && typeof window.api.getTreasuryStatus === 'function') {
            this._trStatus = await window.api.getTreasuryStatus(uid);
            return this._trStatus;
          }
        } catch (_) {}
        this._trStatus = { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0, vaultBalance: 0 };
        return this._trStatus;
      },

      // 1. إدارة نافذة المصاريف وسلفة العمال (#expenseModal)
      updateExpenseModalState() {
        const tr = this._trStatus || { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0, vaultBalance: 0 };
        const srcSel = document.getElementById('expFundingSourceSelect');
        const amtInp = document.getElementById('expAmountInput');
        const badge = document.getElementById('expShiftStatusBadge');
        const hint = document.getElementById('expFundingHint');
        const extBox = document.getElementById('expExternalPayerBox');
        const deductChk = document.getElementById('expDeductCaisseCheckbox');
        const submitBtn = document.getElementById('expSubmitBtn');

        const src = srcSel ? srcSel.value : 'active_shift';
        const amt = Number(amtInp ? amtInp.value : 0) || 0;

        if (deductChk) deductChk.checked = src === 'active_shift';
        if (extBox) extBox.classList.toggle('hidden', src !== 'external_owner');

        if (badge) {
          if (tr.hasOpenShift) {
            badge.textContent = '🟢 وردية #' + tr.sessionId + ' (' + fmtDzd(tr.drawerExpectedCash) + ')';
            badge.className = 'px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
          } else {
            badge.textContent = '🔴 لا توجد وردية مفتوحة';
            badge.className = 'px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-500/15 text-rose-600';
          }
        }

        let blocked = false;
        if (src === 'active_shift') {
          if (!tr.hasOpenShift) {
            blocked = true;
            setAlert('expInlineAlert', '⛔ الوردية مغلقة حالياً — افتح وردية جديدة أو اختر "الخزينة الرئيسية" أو "مال خارجي / المالك".', 'error');
            if (hint) hint.textContent = 'لا يمكن الخصم من درج الوردية وهي مغلقة.';
          } else if (amt > tr.drawerExpectedCash + 0.009) {
            setAlert('expInlineAlert', '⚠️ تنبيه سيولة: المبلغ (' + fmtDzd(amt) + ') أكبر من الكاش المتوفر بالدرج (' + fmtDzd(tr.drawerExpectedCash) + '). يفضّل الصرف من الخزينة الرئيسية أو مال خارجي.', 'warning');
            if (hint) hint.textContent = 'سيُخصم من درج الوردية #' + tr.sessionId + ' ويظهر في تقرير Z-Report.';
          } else {
            setAlert('expInlineAlert', '', '');
            if (hint) hint.textContent = 'سيُخصم من درج الوردية #' + tr.sessionId + ' ويظهر باسم المستفيد في تقرير Z-Report.';
          }
        } else {
          setAlert('expInlineAlert', '', '');
          if (hint) {
            hint.textContent =
              src === 'shop_vault'
                ? 'سيُخصم من الخزينة الرئيسية (التقديري: ' + fmtDzd(tr.vaultBalance) + ') دون المساس بدرج الكاشير.'
                : src === 'bank_ccp'
                ? 'تسديد بنكي / بريدي موب / شيك — لا ينقص درج الكاشير.'
                : 'مال خارجي من المالك / طرف خارجي — يعمل حتى بدون وردية ولا ينقص درج الكاشير، ويُذكر في نهاية الوردية.';
          }
        }

        if (submitBtn) {
          submitBtn.disabled = blocked;
          submitBtn.style.opacity = blocked ? '0.55' : '1';
        }
      },

      async hydrateExpenseModal(presetCategory) {
        await this.fetchStatus();
        const catSel = document.getElementById('expCategoryInput');
        const srcSel = document.getElementById('expFundingSourceSelect');
        const benInp = document.getElementById('expBeneficiaryInput');
        const extInp = document.getElementById('expExternalPayerInput');

        if (presetCategory && catSel) catSel.value = presetCategory;
        if (benInp && !benInp.value) benInp.value = '';
        if (extInp) extInp.value = '';
        if (srcSel) srcSel.value = (this._trStatus && this._trStatus.hasOpenShift) ? 'active_shift' : 'external_owner';

        const modal = document.getElementById('expenseModal');
        if (modal && !modal._s6bBound) {
          modal._s6bBound = true;
          document.getElementById('expFundingSourceSelect')?.addEventListener('change', () => this.updateExpenseModalState());
          document.getElementById('expAmountInput')?.addEventListener('input', () => this.updateExpenseModalState());
        }
        this.updateExpenseModalState();
      },

      async submitExpenseSafe() {
        const category = document.getElementById('expCategoryInput')?.value || 'مصاريف عامة';
        const amount = Number(document.getElementById('expAmountInput')?.value || 0);
        const beneficiary = String(document.getElementById('expBeneficiaryInput')?.value || '').trim();
        const description = String(document.getElementById('expDescInput')?.value || '').trim();
        const fundingSource = document.getElementById('expFundingSourceSelect')?.value || 'active_shift';
        const externalPayer = String(document.getElementById('expExternalPayerInput')?.value || '').trim();

        if (!Number.isFinite(amount) || amount <= 0.009) {
          setAlert('expInlineAlert', 'يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'error');
          return { success: false };
        }

        try {
          const res = await window.api.addExpense({
            category,
            amount,
            beneficiary,
            description,
            funding_source: fundingSource,
            external_payer: externalPayer,
            deductFromCaisse: fundingSource === 'active_shift',
            user_id: window.AppState?.currentUser?.id || null
          });

          if (!res || res.success === false) {
            const msg = (res && res.message) || 'تعذر حفظ المصروف.';
            setAlert('expInlineAlert', msg, 'error');
            window.App?.showToast?.(msg, 'error');
            return res || { success: false };
          }

          window.App?.closeModal?.('expenseModal');
          window.GherbiStage5Ops?.invalidate?.('all');
          if (typeof window.App?.loadExpensesView === 'function') await window.App.loadExpensesView().catch(() => {});
          if (typeof window.App?.loadCaisseView === 'function') await window.App.loadCaisseView().catch(() => {});
          window.App?.showToast?.('✅ تم تسجيل ' + category + ' (' + fmtDzd(amount) + ') — ' + (res.fundingLabel || ''), 'success');
          return res;
        } catch (err) {
          const clean = String((err && err.message) || err).replace(/^Error invoking remote method[^:]+:\s*Error:\s*/i, '');
          setAlert('expInlineAlert', clean, 'error');
          window.App?.showToast?.('❌ ' + clean, 'error');
          return { success: false, error: clean };
        }
      },

      // 2. إدارة نافذة حركة الصندوق (#caisseTxModal)
      updateCaisseTxModalState() {
        const tr = this._trStatus || { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0 };
        const srcSel = document.getElementById('caisseTxFundingSourceSelect');
        const extInp = document.getElementById('caisseTxExternalPayerInput');
        const badge = document.getElementById('caisseTxShiftBadge');
        const submitBtn = document.getElementById('caisseTxSubmitBtn');
        const src = srcSel ? srcSel.value : 'active_shift';

        if (extInp) extInp.classList.toggle('hidden', src !== 'external_owner');
        if (badge) {
          badge.textContent = tr.hasOpenShift
            ? ('🟢 وردية #' + tr.sessionId + ' (' + fmtDzd(tr.drawerExpectedCash) + ')')
            : '🔴 الوردية مغلقة';
        }
        const blocked = src === 'active_shift' && !tr.hasOpenShift;
        if (blocked) {
          setAlert('caisseTxInlineAlert', '⛔ الوردية مغلقة — افتح وردية جديدة أو اختر "الخزينة الرئيسية" أو "مال خارجي".', 'error');
        } else {
          setAlert('caisseTxInlineAlert', '', '');
        }
        if (submitBtn) {
          submitBtn.disabled = blocked;
          submitBtn.style.opacity = blocked ? '0.55' : '1';
        }
      },

      async hydrateCaisseTxModal() {
        await this.fetchStatus();
        const modal = document.getElementById('caisseTxModal');
        if (modal && !modal._s6bBound) {
          modal._s6bBound = true;
          document.getElementById('caisseTxFundingSourceSelect')?.addEventListener('change', () => this.updateCaisseTxModalState());
        }
        const srcSel = document.getElementById('caisseTxFundingSourceSelect');
        if (srcSel) srcSel.value = (this._trStatus && this._trStatus.hasOpenShift) ? 'active_shift' : 'external_owner';
        this.updateCaisseTxModalState();
      },

      async submitCaisseTxSafe() {
        const type = document.getElementById('caisseTxTypeInput')?.value || 'cash_in';
        const amount = Number(document.getElementById('caisseTxAmountInput')?.value || 0);
        const beneficiary = String(document.getElementById('caisseTxBeneficiaryInput')?.value || '').trim();
        const description = String(document.getElementById('caisseTxDescInput')?.value || '').trim();
        const fundingSource = document.getElementById('caisseTxFundingSourceSelect')?.value || 'active_shift';
        const externalPayer = String(document.getElementById('caisseTxExternalPayerInput')?.value || '').trim();

        if (!Number.isFinite(amount) || amount <= 0.009) {
          setAlert('caisseTxInlineAlert', 'يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'error');
          return { success: false };
        }

        try {
          const res = await window.api.addCaisseTransaction({
            type,
            amount,
            beneficiary,
            description,
            funding_source: fundingSource,
            external_payer: externalPayer,
            user_id: window.AppState?.currentUser?.id || null
          });

          if (!res || res.success === false) {
            const msg = (res && res.message) || 'تعذر تسجيل الحركة النقدية.';
            setAlert('caisseTxInlineAlert', msg, 'error');
            window.App?.showToast?.(msg, 'error');
            return res || { success: false };
          }

          window.App?.closeModal?.('caisseTxModal');
          window.GherbiStage5Ops?.invalidate?.('all');
          if (typeof window.App?.loadCaisseView === 'function') await window.App.loadCaisseView().catch(() => {});
          window.App?.showToast?.('✅ تم تسجيل الحركة (' + fmtDzd(amount) + ') — ' + (res.fundingLabel || ''), 'success');
          return res;
        } catch (err) {
          const clean = String((err && err.message) || err).replace(/^Error invoking remote method[^:]+:\s*Error:\s*/i, '');
          setAlert('caisseTxInlineAlert', clean, 'error');
          window.App?.showToast?.('❌ ' + clean, 'error');
          return { success: false, error: clean };
        }
      },

      // 3. إدارة مصدر التمويل في نافذة فاتورة الشراء (#purchaseInvoiceModal)
      updatePurchaseFundingUi() {
        const srcSel = document.getElementById('purchFundingSourceSelect');
        const extInp = document.getElementById('purchExternalPayerInput');
        if (srcSel && extInp) {
          extInp.classList.toggle('hidden', srcSel.value !== 'external_owner');
        }
        setAlert('purchInlineAlert', '', '');
      },

      // 4. ترقية أي نافذة ديناميكية لـ "سلفة عامل" داخل إدارة الصندوق (تُنشأ من gherbi-core-devices-hub.js)
      injectFundingSelectIntoDynamicWorkerAdvanceModal(rootEl) {
        if (!rootEl || rootEl.querySelector('#s6bDynamicWorkerFundingBox')) return;
        const txt = rootEl.textContent || '';
        if (!/سلفة\s+عامل|سلفة\s+نقدية/i.test(txt)) return;

        const targetBtn = Array.from(rootEl.querySelectorAll('button')).find((b) => /تأكيد|حفظ|منح|صرف|تسجيل/i.test(b.textContent || ''));
        if (!targetBtn || !targetBtn.parentElement) return;

        const tr = this._trStatus || { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0 };
        const box = document.createElement('div');
        box.id = 's6bDynamicWorkerFundingBox';
        box.style.cssText = 'margin:8px 0;padding:10px;border-radius:12px;border:1.5px solid #3b82f6;background:#eff6ff;font-size:11.5px;direction:rtl;text-align:right;';
        box.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;font-weight:900;color:#1d4ed8;">' +
            '<span>🏦 مصدر مال السلفة:</span>' +
            '<span style="font-size:10px;">' + (tr.hasOpenShift ? ('🟢 وردية #' + tr.sessionId + ' (' + fmtDzd(tr.drawerExpectedCash) + ')') : '🔴 الوردية مغلقة') + '</span>' +
          '</div>' +
          '<select id="s6bDynWorkerFundingSel" style="width:100%;padding:6px 8px;border-radius:8px;border:1px solid #93c5fd;font-weight:800;font-size:11.5px;background:#fff;color:#0f172a;">' +
            '<option value="active_shift"' + (tr.hasOpenShift ? ' selected' : '') + '>💵 درج الوردية المفتوحة</option>' +
            '<option value="shop_vault">🔐 الخزينة الرئيسية للمتجر (خارج الدرج)</option>' +
            '<option value="external_owner"' + (!tr.hasOpenShift ? ' selected' : '') + '>👤 مال خارجي / من جيب المالك</option>' +
          '</select>' +
          '<input id="s6bDynWorkerExtPayer" type="text" placeholder="اسم الدافع الخارجي (اختياري)..." style="display:' + (!tr.hasOpenShift ? 'block' : 'none') + ';width:100%;margin-top:6px;padding:6px 8px;border-radius:8px;border:1px solid #cbd5e1;font-size:11px;font-weight:700;" />';

        targetBtn.parentElement.parentElement.insertBefore(box, targetBtn.parentElement);
        const sel = box.querySelector('#s6bDynWorkerFundingSel');
        const ext = box.querySelector('#s6bDynWorkerExtPayer');
        if (sel && ext) {
          sel.addEventListener('change', () => {
            ext.style.display = sel.value === 'external_owner' ? 'block' : 'none';
            window.__gherbiNextExpenseFunding = { funding_source: sel.value, external_payer: ext.value.trim() };
          });
          ext.addEventListener('input', () => {
            window.__gherbiNextExpenseFunding = { funding_source: sel.value, external_payer: ext.value.trim() };
          });
          window.__gherbiNextExpenseFunding = { funding_source: sel.value, external_payer: '' };
        }
      },

      // زر اختصار موحّد لفتح سلفة عامل بالمصادر الأربعة من أي مكان
      openWorkerAdvanceModal() {
        if (window.App && typeof window.App.openModal === 'function') {
          window.App.openModal('expenseModal');
          this.hydrateExpenseModal('سلفة عامل');
        }
      },

      installHooks() {
        const app = window.App;
        if (!app || app._s6bFundingHooked) return false;
        app._s6bFundingHooked = true;
        const self = this;

        // 1. تغليف المصاريف وحركات الصندوق
        app.confirmSaveExpense = () => self.submitExpenseSafe();
        app.confirmCaisseTx = () => self.submitCaisseTxSafe();

        // 2. تغليف حفظ فاتورة الشراء لحقن funding_source و external_payer قبل استدعاء savePurchase
        if (typeof app.submitPurchaseInvoice === 'function') {
          const origSubmitPurch = app.submitPurchaseInvoice.bind(app);
          app.submitPurchaseInvoice = async function s6bWrappedSubmitPurchase(...args) {
            const paid = Number(document.getElementById('purchPaidInput')?.value || 0);
            const src = document.getElementById('purchFundingSourceSelect')?.value || 'active_shift';
            const extPayer = String(document.getElementById('purchExternalPayerInput')?.value || '').trim();
            if (paid > 0.009 && src === 'active_shift') {
              const tr = await self.fetchStatus();
              if (!tr.hasOpenShift) {
                const msg = '⛔ الوردية مغلقة — لا يمكن خصم دفعة فاتورة الشراء من درج الوردية. افتح وردية أو اختر "الخزينة الرئيسية" أو "مال خارجي".';
                setAlert('purchInlineAlert', msg, 'error');
                app.showToast?.(msg, 'error');
                return { success: false, error: 'shift_closed' };
              }
            }
            window.__gherbiNextPurchaseFunding = { funding_source: src, external_payer: extPayer };
            return await origSubmitPurch(...args);
          };
        }

        // 3. مراقب النوافذ (#expenseModal, #caisseTxModal, #purchaseInvoiceModal + أي نافذة ديناميكية لسلفة عامل)
        if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
          const watchModal = (id, cb) => {
            const m = document.getElementById(id);
            if (!m || m._s6bWatch) return;
            m._s6bWatch = true;
            const obs = new MutationObserver(() => {
              if (m.classList.contains('active') || m.style.display === 'flex') setTimeout(cb, 40);
            });
            obs.observe(m, { attributes: true, attributeFilter: ['class', 'style'] });
          };

          watchModal('expenseModal', () => self.hydrateExpenseModal());
          watchModal('caisseTxModal', () => self.hydrateCaisseTxModal());
          watchModal('purchaseInvoiceModal', () => self.updatePurchaseFundingUi());

          document.getElementById('purchFundingSourceSelect')?.addEventListener('change', () => self.updatePurchaseFundingUi());

          if (document.body && !document.body._s6bDynWorkerObs) {
            document.body._s6bDynWorkerObs = true;
            const bodyObs = new MutationObserver((muts) => {
              for (let i = 0; i < muts.length; i++) {
                const nodes = muts[i].addedNodes || [];
                for (let j = 0; j < nodes.length; j++) {
                  const n = nodes[j];
                  if (n && n.nodeType === 1 && /سلفة\s+عامل|سلفة\s+نقدية/i.test(n.textContent || '')) {
                    self.fetchStatus().then(() => self.injectFundingSelectIntoDynamicWorkerAdvanceModal(n));
                  }
                }
              }
            });
            bodyObs.observe(document.body, { childList: true, subtree: false });
          }
        }

        return true;
      },

      boot() {
        this.installHooks();
        let tries = 0;
        const iv = setInterval(() => {
          tries++;
          if (this.installHooks() || tries >= 40) clearInterval(iv);
        }, 120);
        console.log('🛡️ [WAR STAGE 6B]: تعميم مصفوفة مصادر التمويل الأربعة (المصاريف + سلفة العمال + الصندوق + المشتريات) جاهز 100%.');
      }
    };

    window.GherbiTreasuryStage6B = Stage6B;
    Stage6B.boot();
  })();
})();

/* === [WAR STAGE 6B: PRELOAD FUNDING HOOK REGISTRATION] === */
(function installStage6BPreloadFundingWire() {
    'use strict';
    if (window.api && typeof window.api.registerStage6BFundingHook === 'function') {
      window.api.registerStage6BFundingHook((ch) => {
        if (ch === 'save-purchase' && window.__gherbiNextPurchaseFunding) {
          const out = window.__gherbiNextPurchaseFunding;
          window.__gherbiNextPurchaseFunding = null;
          return out;
        }
        if (ch === 'add-expense' && window.__gherbiNextExpenseFunding) {
          const out = window.__gherbiNextExpenseFunding;
          window.__gherbiNextExpenseFunding = null;
          return out;
        }
        return null;
      });
    }
  })();

/* === [WAR STAGE 6B+: DYNAMIC EXPENSE (ALT+N), SMART SUPPLY STUDIO & PAGES UPGRADER] === */
(function installWarStage6BPlusDynamicModalsAndPages() {
  'use strict';

  function fmtDzd(v) {
    return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
  }

  function isVisibleModal(el) {
    if (!el) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    if (el.style && el.style.display === 'none') return false;
    return true;
  }

  function installStage6BPlus() {
    const s6b = window.GherbiTreasuryStage6B;
    if (!s6b || s6b._stage6BPlusInstalled) return false;
    s6b._stage6BPlusInstalled = true;

    s6b._liveExpenseFunding = null;
    s6b._livePurchaseFunding = null;

    // ------------------------------------------------------------------------
    // 1. ترقية نافذة المصاريف وسلفة العمال الديناميكية الحية (Alt+N — image_6aba27.png)
    // ------------------------------------------------------------------------
    s6b.upgradeDynamicExpenseModal = async function upgradeLiveExpenseModal(rootEl) {
      if (!rootEl || rootEl.querySelector('#s6cLiveExpenseFundingBox')) return false;

      // البحث عن شريط خانة الاختيار القديمة "خصم المبلغ مباشرة من مناوبة الصندوق المفتوحة حالياً"
      const allLabelsAndDivs = Array.from(rootEl.querySelectorAll('label, div'));
      let oldCaisseBox = null;
      let origChk = null;

      for (let i = allLabelsAndDivs.length - 1; i >= 0; i--) {
        const el = allLabelsAndDivs[i];
        const t = (el.textContent || '').trim();
        if (t.includes('خصم المبلغ مباشرة من مناوبة الصندوق') || t.includes('خصم المبلغ من مناوبة الصندوق')) {
          const chk = el.querySelector('input[type="checkbox"]');
          if (chk && el.querySelectorAll('input').length <= 2) {
            oldCaisseBox = el;
            origChk = chk;
            break;
          }
        }
      }

      if (!oldCaisseBox || !oldCaisseBox.parentElement) return false;

      const tr = await s6b.fetchStatus();
      const defaultSrc = tr && tr.hasOpenShift ? 'active_shift' : 'external_owner';

      // إخفاء الصندوق الوردي القديم مع إبقاء الـ checkbox في DOM متزامناً مع مصدر المال
      oldCaisseBox.style.display = 'none';
      if (origChk) origChk.checked = defaultSrc === 'active_shift';

      const box = document.createElement('div');
      box.id = 's6cLiveExpenseFundingBox';
      box.style.cssText =
        'margin:8px 0;padding:10px 12px;border-radius:14px;border:1.5px solid #2563eb;background:linear-gradient(180deg,#eff6ff 0%,#ffffff 100%);direction:rtl;text-align:right;font-size:11.5px;';

      box.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">' +
          '<span style="font-weight:900;color:#1d4ed8;">🏦 مصدر المال (من أين يخرج هذا المصروف / السلفة؟) *</span>' +
          '<span id="s6cLiveExpShiftBadge" style="padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;"></span>' +
        '</div>' +
        '<select id="s6cLiveExpFundingSel" style="width:100%;padding:7px 10px;border-radius:10px;border:1.5px solid #93c5fd;font-weight:800;font-size:11.5px;background:#ffffff;color:#0f172a;cursor:pointer;">' +
          '<option value="active_shift"' + (defaultSrc === 'active_shift' ? ' selected' : '') + '>💵 درج الوردية المفتوحة حالياً (Caisse Active)</option>' +
          '<option value="shop_vault">🔐 الخزينة الرئيسية للمتجر (Coffre-Fort / خارج درج الكاشير)</option>' +
          '<option value="bank_ccp">🏦 الحساب البنكي / بريدي موب / شيك (CCP / Banque)</option>' +
          '<option value="external_owner"' + (defaultSrc === 'external_owner' ? ' selected' : '') + '>👤 مال خارجي / من جيب المالك (خارج الصندوق تماماً)</option>' +
        '</select>' +
        '<input id="s6cLiveExpExtPayer" type="text" placeholder="اسم الدافع الخارجي (مثال: صاحب المتجر / شريك — يُذكر في Z-Report)..." style="display:' + (defaultSrc === 'external_owner' ? 'block' : 'none') + ';width:100%;margin-top:6px;padding:6px 10px;border-radius:9px;border:1px solid #cbd5e1;font-size:11px;font-weight:800;background:#ffffff;color:#0f172a;" />' +
        '<div id="s6cLiveExpHint" style="margin-top:5px;font-size:10.5px;font-weight:800;color:#475569;"></div>' +
        '<div id="s6cLiveExpAlert" style="display:none;margin-top:6px;padding:7px 9px;border-radius:9px;font-size:11px;font-weight:900;"></div>' +
        '<button id="s6cLiveExpQuickShiftBtn" type="button" style="display:none;width:100%;margin-top:6px;padding:6px;border-radius:9px;border:none;background:#d97706;color:#ffffff;font-size:11px;font-weight:900;cursor:pointer;">🔓 الوردية مغلقة — اضغط هنا لفتح وردية جديدة أو غيّر المصدر إلى الخزينة / مال خارجي</button>';

      oldCaisseBox.parentElement.insertBefore(box, oldCaisseBox);

      const sel = box.querySelector('#s6cLiveExpFundingSel');
      const extInp = box.querySelector('#s6cLiveExpExtPayer');
      const badge = box.querySelector('#s6cLiveExpShiftBadge');
      const hint = box.querySelector('#s6cLiveExpHint');
      const alertBox = box.querySelector('#s6cLiveExpAlert');
      const quickShiftBtn = box.querySelector('#s6cLiveExpQuickShiftBtn');

      // العثور على خانة المبلغ وأزرار الحفظ في النافذة
      const numInputs = Array.from(rootEl.querySelectorAll('input[type="number"]'));
      const amountInp = numInputs.find((inp) => /amount|amt|مبلغ|exp/i.test((inp.id || '') + ' ' + (inp.placeholder || ''))) || numInputs[0] || null;
      const saveBtns = Array.from(rootEl.querySelectorAll('button')).filter((b) => /حفظ المصروف|حفظ وطباعة سند|تسجيل المصروف/i.test(b.textContent || ''));

      const syncState = () => {
        const src = sel ? sel.value : 'active_shift';
        const ext = extInp ? extInp.value.trim() : '';
        const enteredAmt = amountInp ? (Number(amountInp.value || 0) || 0) : 0;

        if (origChk) origChk.checked = src === 'active_shift';
        if (extInp) extInp.style.display = src === 'external_owner' ? 'block' : 'none';

        s6b._liveExpenseFunding = { funding_source: src, external_payer: ext };
        window.__gherbiNextExpenseFunding = { funding_source: src, external_payer: ext };

        if (badge) {
          if (tr && tr.hasOpenShift) {
            badge.textContent = '🟢 وردية #' + tr.sessionId + ' (' + fmtDzd(tr.drawerExpectedCash) + ')';
            badge.style.background = '#dcfce7';
            badge.style.color = '#166534';
          } else {
            badge.textContent = '🔴 لا توجد وردية مفتوحة';
            badge.style.background = '#fee2e2';
            badge.style.color = '#991b1b';
          }
        }

        let blocked = false;
        let alertMsg = '';
        let alertType = '';

        if (src === 'active_shift') {
          if (!tr || !tr.hasOpenShift) {
            blocked = true;
            alertMsg = '⛔ لا يمكن الخصم من درج الوردية لأن الوردية مغلقة حالياً! افتح وردية أو اختر "الخزينة الرئيسية" أو "مال خارجي / المالك".';
            alertType = 'error';
            if (hint) hint.textContent = 'الوردية مغلقة — اختر مصدراً خارج الدرج أو افتح وردية.';
          } else if (enteredAmt > Number(tr.drawerExpectedCash || 0) + 0.009) {
            alertMsg = '⚠️ تنبيه سيولة: المبلغ (' + fmtDzd(enteredAmt) + ') يتجاوز الكاش المتوقع في الدرج (' + fmtDzd(tr.drawerExpectedCash) + '). يُنصح بالصرف من الخزينة الرئيسية أو مال خارجي حتى لا يصبح الدرج سالباً.';
            alertType = 'warn';
            if (hint) hint.textContent = 'سيُخصم من درج الوردية #' + tr.sessionId + ' ويظهر باسم المستفيد في تقرير Z-Report.';
          } else {
            if (hint) hint.textContent = 'سيُخصم من درج الوردية #' + tr.sessionId + ' ويظهر باسم المستفيد والسبب في تقرير إغلاق الوردية (Z-Report).';
          }
        } else if (src === 'shop_vault') {
          if (hint) hint.textContent = 'سيُخصم من الخزينة الرئيسية للمتجر (الرصيد التقديري: ' + fmtDzd(tr ? tr.vaultBalance : 0) + ') دون المساس بدرج الكاشير.';
        } else if (src === 'bank_ccp') {
          if (hint) hint.textContent = 'تسديد عبر البنك / بريدي موب / شيك — لا ينقص الكاش النقدي في درج الكاشير.';
        } else if (src === 'external_owner') {
          if (hint) hint.textContent = 'تمويل خارجي من جيب المالك أو شريك — يعمل حتى والوردية مغلقة ولا يفسد جرد الكاشير، ويُذكر في نهاية الوردية.';
        }

        if (alertBox) {
          if (alertMsg) {
            alertBox.style.display = 'block';
            alertBox.textContent = alertMsg;
            alertBox.style.background = alertType === 'error' ? '#fff1f2' : '#fffbeb';
            alertBox.style.border = alertType === 'error' ? '1px solid #fda4af' : '1px solid #fcd34d';
            alertBox.style.color = alertType === 'error' ? '#be123c' : '#92400e';
          } else {
            alertBox.style.display = 'none';
          }
        }

        if (quickShiftBtn) quickShiftBtn.style.display = blocked ? 'block' : 'none';

        saveBtns.forEach((btn) => {
          btn.disabled = blocked;
          btn.style.opacity = blocked ? '0.5' : '1';
          btn.style.cursor = blocked ? 'not-allowed' : 'pointer';
        });
      };

      if (sel) sel.addEventListener('change', syncState);
      if (extInp) extInp.addEventListener('input', syncState);
      if (amountInp) amountInp.addEventListener('input', syncState);
      if (quickShiftBtn) {
        quickShiftBtn.addEventListener('click', () => {
          const closeBtn = rootEl.querySelector('button[onclick*="closeModal"], button');
          if (window.App && typeof window.App.openModal === 'function') {
            if (closeBtn && /close|×|إلغاء/i.test(closeBtn.textContent || '')) closeBtn.click();
            window.App.openModal('openShiftModal');
          }
        });
      }

      // حماية Capture-Phase على أزرار الحفظ لضمان عدم تمرير صرف من درج مغلق أبداً
      saveBtns.forEach((btn) => {
        if (btn.dataset && btn.dataset.s6cExpGuard) return;
        if (btn.dataset) btn.dataset.s6cExpGuard = '1';
        btn.addEventListener('click', (ev) => {
          syncState();
          if (btn.disabled) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
            window.App?.showToast?.('⛔ الوردية مغلقة — افتح وردية أو اختر "الخزينة الرئيسية" أو "مال خارجي".', 'error');
          }
        }, true);
      });

      // تحديث قراءة السيولة عند النقر على أزرار المبالغ السريعة (10,000 / 25,000...)
      rootEl.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
        if (b && /^[0-9,]+$/.test((b.textContent || '').trim())) {
          setTimeout(syncState, 20);
        }
      });

      syncState();
      return true;
    };

    // ------------------------------------------------------------------------
    // 2. ترقية استوديو فاتورة الشراء والتموين الذكي (Smart Supply Studio — image_6aba10.jpg)
    // ------------------------------------------------------------------------
    s6b.upgradeDynamicPurchaseStudioModal = async function upgradeLivePurchaseStudio(rootEl) {
      if (!rootEl || rootEl.querySelector('#s6cLivePurchaseFundingBar')) return false;

      const txt = rootEl.textContent || '';
      if (!txt.includes('استوديو إنشاء فاتورة الشراء') && !txt.includes('المدفوع للمورد:')) return false;

      const saveBtn = Array.from(rootEl.querySelectorAll('button')).find((b) =>
        /حفظ الفاتورة وتغذية المخزون/i.test(b.textContent || '')
      );
      if (!saveBtn || !saveBtn.parentElement || !saveBtn.parentElement.parentElement) return false;

      const tr = await s6b.fetchStatus();
      const defaultSrc = tr && tr.hasOpenShift ? 'active_shift' : 'shop_vault';

      const bar = document.createElement('div');
      bar.id = 's6cLivePurchaseFundingBar';
      bar.style.cssText =
        'margin:8px 0;padding:9px 12px;border-radius:14px;border:1.5px solid #2563eb;background:linear-gradient(90deg,#eff6ff 0%,#f8fafc 100%);direction:rtl;text-align:right;font-size:11.5px;';

      bar.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<span style="font-weight:900;color:#1d4ed8;">🏦 مصدر مال الدفعة للمورد:</span>' +
            '<select id="s6cLivePurchFundingSel" style="padding:5px 10px;border-radius:9px;border:1.5px solid #93c5fd;font-weight:800;font-size:11.5px;background:#ffffff;color:#0f172a;cursor:pointer;">' +
              '<option value="active_shift"' + (defaultSrc === 'active_shift' ? ' selected' : '') + '>💵 درج الوردية المفتوحة (Caisse Active)</option>' +
              '<option value="shop_vault"' + (defaultSrc === 'shop_vault' ? ' selected' : '') + '>🔐 الخزينة الرئيسية للمتجر (خارج الدرج)</option>' +
              '<option value="bank_ccp">🏦 الحساب البنكي / بريدي موب / شيك</option>' +
              '<option value="external_owner">👤 مال خارجي / من جيب المالك</option>' +
            '</select>' +
            '<input id="s6cLivePurchExtPayer" type="text" placeholder="اسم الدافع الخارجي..." style="display:none;width:165px;padding:5px 9px;border-radius:9px;border:1px solid #cbd5e1;font-size:11px;font-weight:800;background:#ffffff;color:#0f172a;" />' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
            '<span id="s6cLivePurchAdvBadge" style="display:none;padding:3px 9px;border-radius:999px;background:linear-gradient(135deg,#0284c7,#2563eb);color:#ffffff;font-size:10.5px;font-weight:900;"></span>' +
            '<span id="s6cLivePurchShiftBadge" style="padding:3px 9px;border-radius:999px;font-size:10.5px;font-weight:900;"></span>' +
          '</div>' +
        '</div>' +
        '<div id="s6cLivePurchAlert" style="display:none;margin-top:6px;padding:6px 9px;border-radius:9px;font-size:11px;font-weight:900;"></div>';

      // إدراج الشريط مباشرةً فوق صف أزرار الحفظ السفلية
      saveBtn.parentElement.parentElement.insertBefore(bar, saveBtn.parentElement);

      const sel = bar.querySelector('#s6cLivePurchFundingSel');
      const extInp = bar.querySelector('#s6cLivePurchExtPayer');
      const shiftBadge = bar.querySelector('#s6cLivePurchShiftBadge');
      const advBadge = bar.querySelector('#s6cLivePurchAdvBadge');
      const alertBox = bar.querySelector('#s6cLivePurchAlert');

      // تحديد عناصر استوديو الشراء الحية: المورد، المدفوع للمورد، ووسيلة الدفع
      const selects = Array.from(rootEl.querySelectorAll('select'));
      const supSelect = selects.find((s) => /sup|مورد/i.test((s.id || '') + ' ' + ((s.previousElementSibling && s.previousElementSibling.textContent) || ''))) || selects[0] || null;
      const payMethodSel = selects.find((s) => /نقداً|Espèces|شيك|CCP|cib/i.test(s.textContent || '') && s.id !== 's6cLivePurchFundingSel') || null;
      const paidInp = Array.from(rootEl.querySelectorAll('input[type="number"]')).find((inp) =>
        /paid|مدفوع/i.test((inp.id || '') + ' ' + ((inp.parentElement && inp.parentElement.textContent) || ''))
      ) || null;

      const refreshSupplierAdvanceBadge = () => {
        if (!advBadge || !supSelect) return;
        const sid = Number(supSelect.value || 0);
        const list = (window.AppState && Array.isArray(window.AppState.suppliers)) ? window.AppState.suppliers : [];
        const sup = list.find((x) => Number(x.id) === sid);
        const signed = sup ? Number(sup.total_debt || 0) : 0;
        const adv = signed < -0.009 ? Math.abs(signed) : Number((sup && sup.advance_balance) || 0);
        if (adv > 0.009) {
          advBadge.style.display = 'inline-flex';
          advBadge.textContent = '💎 لديك تسبقة عند هذا المورد: ' + fmtDzd(adv);
        } else {
          advBadge.style.display = 'none';
        }
      };

      const syncPurchState = () => {
        const src = sel ? sel.value : 'active_shift';
        const ext = extInp ? extInp.value.trim() : '';
        const paidAmt = paidInp ? (Number(paidInp.value || 0) || 0) : 0;

        if (extInp) extInp.style.display = src === 'external_owner' ? 'inline-block' : 'none';
        s6b._livePurchaseFunding = { funding_source: src, external_payer: ext };
        window.__gherbiNextPurchaseFunding = { funding_source: src, external_payer: ext };

        refreshSupplierAdvanceBadge();

        if (shiftBadge) {
          if (tr && tr.hasOpenShift) {
            shiftBadge.textContent = '🟢 وردية #' + tr.sessionId + ' (' + fmtDzd(tr.drawerExpectedCash) + ')';
            shiftBadge.style.background = '#dcfce7';
            shiftBadge.style.color = '#166534';
          } else {
            shiftBadge.textContent = '🔴 الوردية مغلقة (اختر خزينة/خارجي أو آجل)';
            shiftBadge.style.background = '#fee2e2';
            shiftBadge.style.color = '#991b1b';
          }
        }

        let blocked = false;
        let msg = '';
        let type = '';

        if (paidAmt > 0.009 && src === 'active_shift') {
          if (!tr || !tr.hasOpenShift) {
            blocked = true;
            msg = '⛔ الوردية مغلقة — لا يمكن دفع (' + fmtDzd(paidAmt) + ') من درج الوردية! اختر "الخزينة الرئيسية" أو "مال خارجي / المالك" أو اجعل الفاتورة آجلة (0.00 د.ج).';
            type = 'error';
          } else if (paidAmt > Number(tr.drawerExpectedCash || 0) + 0.009) {
            msg = '⚠️ تنبيه سيولة: الدفعة (' + fmtDzd(paidAmt) + ') أكبر من سيولة درج الوردية (' + fmtDzd(tr.drawerExpectedCash) + '). يُنصح بالدفع من الخزينة الرئيسية أو مال خارجي.';
            type = 'warn';
          }
        }

        if (alertBox) {
          if (msg) {
            alertBox.style.display = 'block';
            alertBox.textContent = msg;
            alertBox.style.background = type === 'error' ? '#fff1f2' : '#fffbeb';
            alertBox.style.border = type === 'error' ? '1px solid #fda4af' : '1px solid #fcd34d';
            alertBox.style.color = type === 'error' ? '#be123c' : '#92400e';
          } else {
            alertBox.style.display = 'none';
          }
        }

        saveBtn.disabled = blocked;
        saveBtn.style.opacity = blocked ? '0.5' : '1';
        saveBtn.style.cursor = blocked ? 'not-allowed' : 'pointer';
      };

      if (sel) sel.addEventListener('change', syncPurchState);
      if (extInp) extInp.addEventListener('input', syncPurchState);
      if (paidInp) paidInp.addEventListener('input', syncPurchState);
      if (supSelect) supSelect.addEventListener('change', syncPurchState);
      if (payMethodSel) {
        payMethodSel.addEventListener('change', () => {
          const v = String(payMethodSel.value || '').toLowerCase();
          if (sel && (v === 'cib' || v === 'cheque' || v === 'baridimob' || v === 'ccp') && sel.value === 'active_shift') {
            sel.value = 'bank_ccp';
          }
          syncPurchState();
        });
      }

      // التقاط النقر على أزرار الدفع السريع (خالص 100% | نصف 50% | آجل دين 0)
      rootEl.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
        if (b && /خالص|نصف|آجل/i.test(b.textContent || '')) {
          setTimeout(syncPurchState, 30);
        }
      });

      // قفل Capture-Phase على زر الحفظ
      saveBtn.addEventListener('click', (ev) => {
        syncPurchState();
        if (saveBtn.disabled) {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          window.App?.showToast?.('⛔ الوردية مغلقة — غيّر مصدر مال الدفعة إلى الخزينة الرئيسية أو مال خارجي.', 'error');
        }
      }, true);

      syncPurchState();
      return true;
    };

    // ------------------------------------------------------------------------
    // 3. تلوين شارات مصدر التمويل وشريط الخزائن الحي في صفحتَي المصاريف والمشتريات
    // ------------------------------------------------------------------------
    s6b.enhanceExpensesAndPurchasesPages = async function enhanceLivePages() {
      // أ) شريط الخزائن الحي أعلى صفحة المصاريف
      if (window.GherbiExpensesMasterV2) return;
      const expView = document.getElementById('view-expenses');
      if (expView) {
        const tr = await s6b.fetchStatus();
        let strip = expView.querySelector('#s6cExpensesTreasuryStrip');
        if (!strip && expView.firstElementChild) {
          strip = document.createElement('div');
          strip.id = 's6cExpensesTreasuryStrip';
          strip.style.cssText =
            'margin-bottom:10px;padding:8px 12px;border-radius:14px;border:1px solid #bfdbfe;background:linear-gradient(90deg,#eff6ff 0%,#ffffff 100%);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;font-size:11.5px;font-weight:800;direction:rtl;';
          expView.firstElementChild.insertBefore(strip, expView.firstElementChild.firstChild);
        }
        if (strip && tr) {
          strip.innerHTML =
            '<span style="color:#1e3a8a;font-weight:900;">🏦 لوحة مصادر التمويل الحية:</span>' +
            '<span style="padding:3px 10px;border-radius:999px;background:' + (tr.hasOpenShift ? '#dcfce7;color:#166534;' : '#fee2e2;color:#991b1b;') + '">' +
              (tr.hasOpenShift ? ('🟢 درج الوردية #' + tr.sessionId + ': ' + fmtDzd(tr.drawerExpectedCash)) : '🔴 لا توجد وردية مفتوحة حالياً') +
            '</span>' +
            '<span style="padding:3px 10px;border-radius:999px;background:#e0e7ff;color:#3730a3;">🔐 الخزينة الرئيسية: ' + fmtDzd(tr.vaultBalance) + '</span>' +
            '<span style="padding:3px 10px;border-radius:999px;background:#fef3c7;color:#92400e;">👤 مموّل خارجياً بالوردية: ' + fmtDzd(tr.externalPaidInShift || 0) + '</span>';
        }

        // تلوين شارات [المصدر: ...] في سطور جدول المصاريف
        const expRows = expView.querySelectorAll('tbody tr');
        expRows.forEach((row) => {
          if (row.dataset && row.dataset.s6cBadgeDone === '1') return;
          const txt = row.textContent || '';
          let badgeHtml = '';
          if (txt.includes('مال خارجي')) {
            badgeHtml = '<span style="display:inline-block;margin-right:5px;padding:1px 7px;border-radius:999px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;font-size:10px;font-weight:900;">👤 مال خارجي</span>';
          } else if (txt.includes('الخزينة الرئيسية')) {
            badgeHtml = '<span style="display:inline-block;margin-right:5px;padding:1px 7px;border-radius:999px;background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc;font-size:10px;font-weight:900;">🔐 الخزينة الرئيسية</span>';
          } else if (txt.includes('الحساب البنكي') || txt.includes('CCP')) {
            badgeHtml = '<span style="display:inline-block;margin-right:5px;padding:1px 7px;border-radius:999px;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;font-size:10px;font-weight:900;">🏦 بنك / CCP</span>';
          } else if (txt.length > 10) {
            badgeHtml = '<span style="display:inline-block;margin-right:5px;padding:1px 7px;border-radius:999px;background:#dcfce7;color:#166534;border:1px solid #86efac;font-size:10px;font-weight:900;">💵 درج الوردية</span>';
          }
          const tds = row.querySelectorAll('td');
          const descTd = tds[2] || tds[1] || tds[0];
          if (descTd && badgeHtml) {
            if (row.dataset) row.dataset.s6cBadgeDone = '1';
            const sp = document.createElement('span');
            sp.innerHTML = badgeHtml;
            descTd.appendChild(sp);
          }
        });
      }
    };

    // ------------------------------------------------------------------------
    // 4. ترقية خطاف preload.js لقراءة مصدر المال مباشرةً من النافذة الحية لحظة الإرسال!
    // ------------------------------------------------------------------------
    if (window.api && typeof window.api.registerStage6BFundingHook === 'function') {
      window.api.registerStage6BFundingHook((ch) => {
        if (ch === 'add-expense' || ch === 'pay-employee-salary') {
          const liveSel = document.getElementById('s6cLiveExpFundingSel');
          const liveExt = document.getElementById('s6cLiveExpExtPayer');
          if (liveSel) {
            return { funding_source: liveSel.value, external_payer: liveExt ? liveExt.value.trim() : '' };
          }
          const staticSel = document.getElementById('expFundingSourceSelect');
          const staticExt = document.getElementById('expExternalPayerInput');
          if (staticSel && isVisibleModal(document.getElementById('expenseModal'))) {
            return { funding_source: staticSel.value, external_payer: staticExt ? staticExt.value.trim() : '' };
          }
          return s6b._liveExpenseFunding || window.__gherbiNextExpenseFunding || null;
        }

        if (ch === 'save-purchase' || ch === 'add-invoice-payment') {
          const liveSel = document.getElementById('s6cLivePurchFundingSel');
          const liveExt = document.getElementById('s6cLivePurchExtPayer');
          if (liveSel) {
            return { funding_source: liveSel.value, external_payer: liveExt ? liveExt.value.trim() : '' };
          }
          const staticSel = document.getElementById('purchFundingSourceSelect');
          const staticExt = document.getElementById('purchExternalPayerInput');
          if (staticSel && isVisibleModal(document.getElementById('purchaseInvoiceModal'))) {
            return { funding_source: staticSel.value, external_payer: staticExt ? staticExt.value.trim() : '' };
          }
          return s6b._livePurchaseFunding || window.__gherbiNextPurchaseFunding || null;
        }

        return null;
      });
    }

    // ------------------------------------------------------------------------
    // 5. مراقب DOM ذكي خفيف يلتقط فتح أي نافذة مصاريف (Alt+N) أو استوديو مشتريات (Smart Supply)
    // ------------------------------------------------------------------------
    s6b.scanAndUpgradeOpenDynamicModals = function scanNow() {
      if (typeof document === 'undefined') return;
      const overlays = Array.from(document.querySelectorAll('.modal-overlay, [role="dialog"], div[class*="fixed"]'));
      for (let i = overlays.length - 1; i >= 0; i--) {
        const el = overlays[i];
        if (!isVisibleModal(el)) continue;
        const txt = el.textContent || '';
        if (txt.includes('خصم المبلغ مباشرة من مناوبة الصندوق') && !el.querySelector('#s6cLiveExpenseFundingBox')) {
          s6b.upgradeDynamicExpenseModal(el);
        }
        if ((txt.includes('استوديو إنشاء فاتورة الشراء') || txt.includes('Smart Supply & Profit Radar')) && !el.querySelector('#s6cLivePurchaseFundingBar')) {
          s6b.upgradeDynamicPurchaseStudioModal(el);
        }
      }
      s6b.enhanceExpensesAndPurchasesPages();
    };

    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && document.body && !document.body._s6cDynObserver) {
      document.body._s6cDynObserver = true;
      let timer = null;
      const scheduleScan = () => {
        clearTimeout(timer);
        timer = setTimeout(() => s6b.scanAndUpgradeOpenDynamicModals(), 65);
      };
      const obs = new MutationObserver((muts) => {
        for (let i = 0; i < muts.length; i++) {
          const m = muts[i];
          if (m.type === 'childList' && m.addedNodes && m.addedNodes.length > 0) {
            scheduleScan();
            return;
          }
          if (m.type === 'attributes' && m.target && m.target.classList && (m.target.classList.contains('modal-overlay') || m.target.classList.contains('view-section'))) {
            scheduleScan();
            return;
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    }

    setTimeout(() => s6b.scanAndUpgradeOpenDynamicModals(), 250);
    console.log('🛡️ [WAR STAGE 6B+]: ترقية النوافذ الديناميكية (المصاريف Alt+N + استوديو المشتريات الذكي + شارات الصفحات) جاهزة 100%.');
    return true;
  }

  if (!installStage6BPlus()) {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (installStage6BPlus() || tries >= 40) clearInterval(iv);
    }, 100);
  }
})();
