/**
 * perf-core/treasury-funding-stage6a.js
 * الشطر 6-أ: محرك مصادر التمويل الأربعة وإدارة الموردين (قفل الوردية + التسبقة Avance + 4 خزائن)
 */
'use strict';
(function buildStage6ATreasuryModule() {
  (function initWarStage6ATreasuryAndSuppliers() {
    'use strict';

    if (window.GherbiTreasuryStage6A && window.GherbiTreasuryStage6A._installed) {
      return;
    }

    function fmtDzd(v) {
      const n = Number(v || 0);
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    }

    function showInlineAlert(msg, level) {
      const box = document.getElementById('supPayInlineAlert');
      if (!box) return;
      if (!msg) {
        box.classList.add('hidden');
        box.textContent = '';
        return;
      }
      box.classList.remove('hidden', 'bg-rose-500/10', 'border-rose-500/40', 'text-rose-600', 'bg-amber-500/10', 'border-amber-500/40', 'text-amber-700', 'bg-emerald-500/10', 'border-emerald-500/40', 'text-emerald-700');
      if (level === 'warning') {
        box.classList.add('bg-amber-500/10', 'border-amber-500/40', 'text-amber-700');
      } else if (level === 'success') {
        box.classList.add('bg-emerald-500/10', 'border-emerald-500/40', 'text-emerald-700');
      } else {
        box.classList.add('bg-rose-500/10', 'border-rose-500/40', 'text-rose-600');
      }
      box.textContent = msg;
    }

    const Stage6A = {
      _installed: true,
      version: '6A.0.0-treasury-suppliers',
      _activeSupplier: null,
      _treasuryStatus: null,

      async loadTreasuryStatus() {
        const uid = window.AppState?.currentUser?.id || null;
        try {
          if (window.api && typeof window.api.getTreasuryStatus === 'function') {
            this._treasuryStatus = await window.api.getTreasuryStatus(uid);
            return this._treasuryStatus;
          }
          if (window.api && typeof window.api.getActiveSession === 'function') {
            const sess = await window.api.getActiveSession(uid);
            this._treasuryStatus = {
              hasOpenShift: Boolean(sess && sess.session && sess.session.id),
              sessionId: sess && sess.session ? sess.session.id : null,
              cashierName: sess && sess.session ? (sess.session.user_name || '') : '',
              drawerExpectedCash: sess && sess.summary ? Number(sess.summary.expectedBalance || 0) : 0,
              vaultBalance: 0
            };
            return this._treasuryStatus;
          }
        } catch (_) {}
        this._treasuryStatus = { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0, vaultBalance: 0 };
        return this._treasuryStatus;
      },

      async resolveSupplierById(supplierId) {
        const sid = Number(supplierId || 0);
        if (!sid) return null;
        try {
          if (window.api && typeof window.api.getSuppliers === 'function') {
            const list = await window.api.getSuppliers();
            if (Array.isArray(list)) {
              if (window.AppState) window.AppState.suppliers = list;
              const found = list.find((s) => Number(s.id) === sid);
              if (found) return found;
            }
          }
        } catch (_) {}
        const cached = (window.AppState && Array.isArray(window.AppState.suppliers)) ? window.AppState.suppliers : [];
        return cached.find((s) => Number(s.id) === sid) || null;
      },

      updateModalLiveState() {
        const sup = this._activeSupplier;
        const tr = this._treasuryStatus || { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0, vaultBalance: 0 };

        const debtValEl = document.getElementById('supPayCurrentDebtVal');
        const fillBtn = document.getElementById('supPayFillFullBtn');
        const amtInp = document.getElementById('supPayAmountInput');
        const advBox = document.getElementById('supPayAllowAdvanceBox');
        const advChk = document.getElementById('supPayAllowAdvanceChk');
        const srcSel = document.getElementById('supPayFundingSourceSelect');
        const methodSel = document.getElementById('supPayMethodSelect');
        const badge = document.getElementById('supPayShiftStatusBadge');
        const hintEl = document.getElementById('supPayFundingHint');
        const quickRow = document.getElementById('supPayQuickOpenShiftRow');
        const extBox = document.getElementById('supPayExternalPayerBox');
        const submitBtn = document.getElementById('supPaySubmitBtn');

        const debt = Number(Number((sup && sup.total_debt) || 0).toFixed(2));
        const enteredAmt = Number(amtInp ? amtInp.value : 0) || 0;
        const src = srcSel ? srcSel.value : 'active_shift';

        if (debtValEl) {
          if (debt > 0.009) {
            debtValEl.textContent = fmtDzd(debt);
            debtValEl.className = 'text-xl font-black font-mono text-rose-600 mt-0.5';
          } else if (debt < -0.009) {
            debtValEl.textContent = 'لنا تسبقة: ' + fmtDzd(Math.abs(debt));
            debtValEl.className = 'text-lg font-black font-mono text-emerald-600 mt-0.5';
          } else {
            debtValEl.textContent = '0.00 د.ج (الحساب خالص)';
            debtValEl.className = 'text-lg font-black font-mono text-emerald-600 mt-0.5';
          }
        }

        if (fillBtn) {
          fillBtn.style.display = debt > 0.009 ? '' : 'none';
          fillBtn.onclick = () => {
            if (amtInp) {
              amtInp.value = debt.toFixed(2);
              this.updateModalLiveState();
            }
          };
        }

        // إظهار خيار التسبقة تلقائياً إذا كان الدين 0 أو كان المبلغ المدخل أكبر من الدين
        const needsAdvance = debt <= 0.009 || enteredAmt > debt + 0.009;
        if (advBox) advBox.classList.toggle('hidden', !needsAdvance);
        if (!needsAdvance && advChk) advChk.checked = false;

        // تحديث شارة الوردية المفتوحة
        if (badge) {
          if (tr.hasOpenShift) {
            badge.textContent = '🟢 وردية #' + tr.sessionId + ' مفتوحة (' + fmtDzd(tr.drawerExpectedCash) + ')';
            badge.className = 'px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
          } else {
            badge.textContent = '🔴 لا توجد وردية مفتوحة';
            badge.className = 'px-2 py-0.5 rounded-lg text-[10px] font-black bg-rose-500/15 text-rose-600';
          }
        }

        // إظهار حقل الدافع الخارجي عند اختيار مال خارجي
        if (extBox) extBox.classList.toggle('hidden', src !== 'external_owner');
        if (quickRow) quickRow.classList.toggle('hidden', !(src === 'active_shift' && !tr.hasOpenShift));

        // المزامنة الذكية بين مصدر المال وطريقة الدفع
        if (methodSel && src === 'bank_ccp' && methodSel.value === 'cash') {
          methodSel.value = 'cib';
        }

        // تحديث الشرح والتنبيهات الفورية
        let blockReason = '';
        let warnMsg = '';

        if (src === 'active_shift') {
          if (!tr.hasOpenShift) {
            blockReason = '⛔ لا يمكن الخصم من درج الوردية لأن الوردية مغلقة حالياً — افتح وردية جديدة أو اختر "الخزينة الرئيسية" أو "مال خارجي / المالك".';
          } else if (enteredAmt > tr.drawerExpectedCash + 0.009) {
            warnMsg = '⚠️ تنبيه سيولة: المبلغ (' + fmtDzd(enteredAmt) + ') يتجاوز السيولة المتوقعة في الدرج (' + fmtDzd(tr.drawerExpectedCash) + '). يفضّل الدفع من الخزينة الرئيسية أو مال خارجي حتى لا يصبح الدرج سالباً.';
          }
          if (hintEl) hintEl.textContent = tr.hasOpenShift
            ? 'سيُخصم المبلغ مباشرةً من درج الوردية #' + tr.sessionId + ' ويظهر في تقرير Z-Report ضمن الأموال الخارجة.'
            : 'الوردية مغلقة — اختر مصدراً خارجياً أو افتح وردية.';
        } else if (src === 'shop_vault') {
          if (hintEl) hintEl.textContent = 'سيُخصم من الخزينة الرئيسية (الرصيد التقديري: ' + fmtDzd(tr.vaultBalance) + ') دون المساس بدرج الكاشير.';
        } else if (src === 'bank_ccp') {
          if (hintEl) hintEl.textContent = 'تسديد بنكي / بريدي موب / شيك — لا يؤثر على الكاش النقدي داخل درج الكاشير.';
        } else if (src === 'external_owner') {
          if (hintEl) hintEl.textContent = 'تمويل خارجي من المالك أو طرف خارجي — يعمل حتى بدون وردية ولا ينقص درج الكاشير، ويُذكر في تقرير نهاية الوردية.';
        }

        if (!blockReason && debt <= 0.009 && !(advChk && advChk.checked)) {
          warnMsg = 'ℹ️ هذا المورد ليس له دين مستحق حالياً (0.00 د.ج). فعّل مربع "تسبقة / Avance" أعلاه إن أردت الدفع له مقدماً.';
        }

        if (blockReason) showInlineAlert(blockReason, 'error');
        else if (warnMsg) showInlineAlert(warnMsg, 'warning');
        else showInlineAlert('', '');

        if (submitBtn) {
          const isBlocked = Boolean(blockReason) || (debt <= 0.009 && !(advChk && advChk.checked));
          submitBtn.disabled = isBlocked;
          submitBtn.style.opacity = isBlocked ? '0.55' : '1';
          submitBtn.style.cursor = isBlocked ? 'not-allowed' : 'pointer';
          submitBtn.textContent = (advChk && advChk.checked)
            ? '✅ تسجيل تسبقة (Avance) وطباعة الوصل'
            : '✅ تأكيد التسديد وطباعة الوصل';
        }
      },

      async hydrateSupplierPaymentModal(supplierIdOverride) {
        const sidInp = document.getElementById('supPaySupplierId');
        const sid = Number(supplierIdOverride || (sidInp && sidInp.value) || 0);
        if (!sid) return;
        if (sidInp) sidInp.value = String(sid);

        const [sup, tr] = await Promise.all([
          this.resolveSupplierById(sid),
          this.loadTreasuryStatus()
        ]);
        this._activeSupplier = sup;
        this._treasuryStatus = tr;

        const titleEl = document.getElementById('supPayModalTitle');
        if (titleEl && sup) {
          titleEl.textContent = 'تسديد دفعة للمورد: ' + (sup.name || '#' + sid);
        }

        const amtInp = document.getElementById('supPayAmountInput');
        const srcSel = document.getElementById('supPayFundingSourceSelect');
        const advChk = document.getElementById('supPayAllowAdvanceChk');
        const extInp = document.getElementById('supPayExternalPayerInput');

        const debt = Number(Number((sup && sup.total_debt) || 0).toFixed(2));
        if (amtInp) {
          amtInp.value = debt > 0.009 ? debt.toFixed(2) : '';
          amtInp.placeholder = debt > 0.009 ? debt.toFixed(2) : 'أدخل مبلغ التسبقة...';
        }
        if (advChk) advChk.checked = false;
        if (extInp) extInp.value = '';
        if (srcSel) {
          srcSel.value = tr && tr.hasOpenShift ? 'active_shift' : 'external_owner';
        }

        this.bindModalControls();
        this.updateModalLiveState();
      },

      bindModalControls() {
        const modal = document.getElementById('supplierPaymentModal');
        if (!modal || modal._s6aBound) return;
        modal._s6aBound = true;

        const amtInp = document.getElementById('supPayAmountInput');
        const srcSel = document.getElementById('supPayFundingSourceSelect');
        const advChk = document.getElementById('supPayAllowAdvanceChk');
        const methodSel = document.getElementById('supPayMethodSelect');
        const quickOpenBtn = document.getElementById('supPayQuickOpenShiftBtn');

        if (amtInp) amtInp.addEventListener('input', () => this.updateModalLiveState());
        if (srcSel) srcSel.addEventListener('change', () => this.updateModalLiveState());
        if (advChk) advChk.addEventListener('change', () => this.updateModalLiveState());
        if (methodSel) {
          methodSel.addEventListener('change', () => {
            if (srcSel && (methodSel.value === 'cib' || methodSel.value === 'cheque') && srcSel.value === 'active_shift') {
              srcSel.value = 'bank_ccp';
            }
            this.updateModalLiveState();
          });
        }
        if (quickOpenBtn) {
          quickOpenBtn.addEventListener('click', () => {
            if (window.App && typeof window.App.closeModal === 'function') window.App.closeModal('supplierPaymentModal');
            if (window.App && typeof window.App.openModal === 'function') window.App.openModal('openShiftModal');
          });
        }
      },

      async submitSupplierPaymentSafe(shouldPrint = true) {
        const sid = Number(document.getElementById('supPaySupplierId')?.value || 0);
        const amt = Number(document.getElementById('supPayAmountInput')?.value || 0);
        const method = document.getElementById('supPayMethodSelect')?.value || 'cash';
        const notes = String(document.getElementById('supPayNotesInput')?.value || '').trim();
        const fundingSource = document.getElementById('supPayFundingSourceSelect')?.value || 'active_shift';
        const externalPayer = String(document.getElementById('supPayExternalPayerInput')?.value || '').trim();
        const allowAdvance = Boolean(document.getElementById('supPayAllowAdvanceChk')?.checked);

        if (!sid) {
          showInlineAlert('لم يتم تحديد المورد.', 'error');
          return { success: false };
        }
        if (!Number.isFinite(amt) || amt <= 0.009) {
          showInlineAlert('يرجى إدخال مبلغ صحيح أكبر من الصفر.', 'error');
          return { success: false };
        }

        const tr = await this.loadTreasuryStatus();
        if (fundingSource === 'active_shift' && !tr.hasOpenShift) {
          showInlineAlert('⛔ الوردية مغلقة حالياً — افتح وردية أو غيّر مصدر الدفع إلى "الخزينة الرئيسية" أو "مال خارجي".', 'error');
          return { success: false };
        }

        try {
          const res = await window.api.addSupplierPayment(sid, amt, new Date().toISOString(), {
            payment_method: method,
            notes,
            funding_source: fundingSource,
            external_payer: externalPayer,
            allow_advance: allowAdvance,
            userId: window.AppState?.currentUser?.id || null
          });

          if (!res || res.success === false) {
            const errMsg = (res && res.message) || 'تعذر إتمام عملية التسديد للمورد.';
            showInlineAlert(errMsg, 'error');
            if (window.App && typeof window.App.showToast === 'function') {
              window.App.showToast(errMsg, 'error');
            }
            return res || { success: false };
          }

          if (window.App && typeof window.App.closeModal === 'function') {
            window.App.closeModal('supplierPaymentModal');
          }

          // إبطال الكاش وتحديث صفحة الموردين والصندوق فوراً
          if (window.GherbiStage4Turbo) window.GherbiStage4Turbo.invalidate('all');
          if (window.GherbiStage5Ops) window.GherbiStage5Ops.invalidate('all');
          if (window.App && typeof window.App.loadSuppliersView === 'function') {
            await window.App.loadSuppliersView().catch(() => {});
          } else if (window.GherbiSuppliersTurbo && typeof window.GherbiSuppliersTurbo.render === 'function') {
            await window.GherbiSuppliersTurbo.render(true).catch(() => {});
          }

          if (window.App && typeof window.App.showToast === 'function') {
            const label = res.isAdvance ? 'تم تسجيل تسبقة للمورد' : 'تم تسديد دفعة للمورد';
            window.App.showToast('✅ ' + label + ' (' + fmtDzd(res.appliedAmount || amt) + ') — ' + (res.fundingLabel || ''), 'success');
          }

          // طباعة وصل المورد المعتمد من مركز الطباعة (supplier_payment_receipt)
          if (shouldPrint && window.GherbiPrintStudioPro && window.GherbiPrintStudioPro.router) {
            const sup = this._activeSupplier || { name: res.supplierName || ('المورد #' + sid), phone: '' };
            const docData = {
              docNumber: res.receiptNumber || ('REC-SUP-' + (res.paymentId || '')),
              date: new Date().toISOString().replace('T', ' ').slice(0, 16),
              isWalkinCustomer: false,
              partyTitle: 'المورد / المستفيد:',
              partyName: sup.name || res.supplierName || ('المورد #' + sid),
              partyPhone: sup.phone || '',
              paymentMethod: (res.fundingLabel || '') + ' (' + method + ')',
              cashierName: window.AppState?.currentUser?.name || 'المدير العام',
              items: [{
                barcode: res.isAdvance ? 'ADV' : 'PAY',
                name: (res.isAdvance ? 'تسبقة مسبقة للمورد (Avance)' : 'دفعة تسديد حساب المورد') + (notes ? (' — ' + notes) : ''),
                unit: 'دفعة',
                qty: 1,
                price: res.appliedAmount || amt,
                subtotal: res.appliedAmount || amt
              }],
              subtotal: res.appliedAmount || amt,
              discount: 0,
              total: res.appliedAmount || amt,
              paidAmount: res.appliedAmount || amt,
              receivedAmount: res.appliedAmount || amt,
              remainingDebt: Math.max(0, Number(res.remainingDebtAfter || 0))
            };
            await window.GherbiPrintStudioPro.router.printDocumentByType('supplier_payment_receipt', docData, { silent: false }).catch(() => {});
          }

          return res;
        } catch (err) {
          const cleanMsg = String((err && err.message) || err || 'خطأ غير متوقع').replace(/^Error invoking remote method[^:]+:\s*Error:\s*/i, '');
          showInlineAlert(cleanMsg, 'error');
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast('❌ ' + cleanMsg, 'error');
          }
          return { success: false, error: cleanMsg };
        }
      },

      // تحسين أزرار جدول إدارة الموردين: تمييز المورد الخالص (0.00 د.ج) عن المورد المدين بوضوح بصري فوري
      enhanceSuppliersTableButtons() {
        const view = document.getElementById('view-suppliers');
        if (!view) return;
        const rows = view.querySelectorAll('tbody tr');
        rows.forEach((tr) => {
          const txt = tr.textContent || '';
          const payBtn = Array.from(tr.querySelectorAll('button')).find((b) => /تسديد/.test(b.textContent || '') && !b.dataset.s6aStyled);
          if (!payBtn) return;

          // فحص ما إذا كان عمود الدين المتبقي للمورد يساوي 0.00 د.ج
          const cells = Array.from(tr.querySelectorAll('td'));
          const debtCell = cells.find((td) => /0\.00\s*د\.ج/.test(td.textContent || '') && !/مشتريات/.test(td.textContent || ''));
          const hasZeroDebt = Boolean(debtCell && /\b0\.00\s*د\.ج/.test((debtCell.textContent || '').trim()));

          payBtn.dataset.s6aStyled = '1';
          if (hasZeroDebt) {
            payBtn.innerHTML = '✅ خالص <span style="opacity:0.8;font-size:10px;">(تسبقة)</span>';
            payBtn.title = 'لا يوجد دين مستحق — اضغط فقط إذا أردت تسجيل تسبقة (Avance) لهذا المورد';
            payBtn.style.background = '#e2e8f0';
            payBtn.style.color = '#334155';
            payBtn.style.border = '1px solid #cbd5e1';
          }
        });
      },

      installHooks() {
        const app = window.App;
        if (!app || app._s6aSuppliersHooked) return false;
        app._s6aSuppliersHooked = true;
        const self = this;

        // 1. تغليف فتح نافذة تسديد المورد لجلب الدين الحي وحالة الوردية فوراً
        if (typeof app.openSupplierPaymentModal === 'function') {
          const origOpen = app.openSupplierPaymentModal.bind(app);
          app.openSupplierPaymentModal = async function s6aOpenSupPay(supId, ...rest) {
            const out = await origOpen(supId, ...rest);
            await self.hydrateSupplierPaymentModal(supId);
            return out;
          };
        }

        // 2. استبدال دالة الحفظ بدالتنا المحصّنة ذات الـ 4 مصادر والتعامل الآمن مع الأخطاء
        app.submitSupplierPaymentModal = function s6aSubmitSupPay(shouldPrint = true) {
          return self.submitSupplierPaymentSafe(shouldPrint);
        };

        // 3. مراقب خفيف على #supplierPaymentModal و #view-suppliers (يغطي أي فتح مباشر عبر GherbiSuppliersTurbo)
        if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
          const modal = document.getElementById('supplierPaymentModal');
          if (modal && !modal._s6aObs) {
            modal._s6aObs = true;
            const obs = new MutationObserver(() => {
              if (modal.classList.contains('active') || modal.style.display === 'flex') {
                setTimeout(() => self.hydrateSupplierPaymentModal(), 40);
              }
            });
            obs.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
          }

          const supView = document.getElementById('view-suppliers');
          if (supView && !supView._s6aTableObs) {
            supView._s6aTableObs = true;
            let t = null;
            const obs = new MutationObserver(() => {
              clearTimeout(t);
              t = setTimeout(() => self.enhanceSuppliersTableButtons(), 60);
            });
            obs.observe(supView, { childList: true, subtree: true });
          }
        }

        return true;
      },

      boot() {
        this.bindModalControls();
        this.installHooks();
        let tries = 0;
        const iv = setInterval(() => {
          tries++;
          if (this.installHooks() || tries >= 40) clearInterval(iv);
        }, 120);
        console.log('🛡️ [WAR STAGE 6A]: محرك مصادر التمويل الأربعة وإدارة الموردين الذكية جاهز 100% (GherbiTreasuryStage6A).');
      }
    };

    window.GherbiTreasuryStage6A = Stage6A;
    Stage6A.boot();
  })();
})();

/* === [WAR STAGE 6B-PART1: VISIBLE SUPPLIER ADVANCES & 100% ROW SYNC] === */
(function installStage6ASupplierAdvancesTableUpgraderV2() {
  'use strict';

  function fmtNum(v) {
    return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
  }

  function patchStage6A() {
    const s6a = window.GherbiTreasuryStage6A;
    if (!s6a || s6a._advancesUiUpgradedV2) return false;
    s6a._advancesUiUpgradedV2 = true;
    s6a._onlyAdvancesFilter = false;
    s6a._lastSupRefreshTs = 0;

    function extractSupIdFromRow(tr) {
      if (tr && tr.dataset) {
        const did = Number(tr.dataset.supplierId || tr.dataset.supId || tr.dataset.id || 0);
        if (did > 0) return did;
      }
      const html = (tr && tr.innerHTML) || '';
      const m = html.match(/(?:openSupplierPaymentModal|openSupplierLedger|editSupplier|deleteSupplier|paySupplier)\s*\(\s*(\d+)/);
      return m && m[1] ? Number(m[1]) : 0;
    }

    s6a.enhanceSuppliersTableButtons = function enhanceSuppliersTableWithAdvancesV2() {
      const view = document.getElementById('view-suppliers');
      if (!view) return;

      const list = (window.AppState && Array.isArray(window.AppState.suppliers)) ? window.AppState.suppliers : [];

      // جلب صامت لمرة واحدة كل 1.5 ثانية إذا كانت القائمة فارغة أو لا تحتوي على advance_balance
      const now = Date.now();
      if (
        (list.length === 0 || (list[0] && list[0].advance_balance === undefined)) &&
        window.api &&
        typeof window.api.getSuppliers === 'function' &&
        now - (s6a._lastSupRefreshTs || 0) > 1500
      ) {
        s6a._lastSupRefreshTs = now;
        window.api.getSuppliers().then((fresh) => {
          if (Array.isArray(fresh) && window.AppState) {
            window.AppState.suppliers = fresh;
            s6a.enhanceSuppliersTableButtons();
          }
        }).catch(() => {});
      }

      if (list.length === 0) return;

      const byId = new Map();
      const byName = new Map();
      let totalAdvancesSum = 0;
      let advancesCount = 0;

      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s) continue;
        byId.set(Number(s.id), s);
        byName.set(String(s.name || '').trim().toLowerCase(), s);
        const signed = Number(s.total_debt || 0);
        const adv = signed < -0.009 ? Math.abs(signed) : Number(s.advance_balance || 0);
        if (adv > 0.009) {
          totalAdvancesSum += adv;
          advancesCount++;
        }
      }
      totalAdvancesSum = Number(totalAdvancesSum.toFixed(2));

      // تحديد عمود "الدين المتبقي للمورد" بدقة من ترويسة الجدول
      let debtColIdx = -1;
      const ths = Array.from(view.querySelectorAll('thead th'));
      for (let i = 0; i < ths.length; i++) {
        if (/الدين المتبقي|المتبقي للمورد/i.test(ths[i].textContent || '')) {
          debtColIdx = i;
          break;
        }
      }

      const rows = Array.from(view.querySelectorAll('tbody tr'));
      rows.forEach((tr) => {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length < 2) return;

        let sup = null;
        const rowId = extractSupIdFromRow(tr);
        if (rowId && byId.has(rowId)) {
          sup = byId.get(rowId);
        } else {
          const lines = String((tds[0] && tds[0].textContent) || '').split(/\r?\n/).map((x) => x.trim().toLowerCase()).filter(Boolean);
          for (let j = 0; j < lines.length; j++) {
            if (byName.has(lines[j])) {
              sup = byName.get(lines[j]);
              break;
            }
          }
        }
        if (!sup) return;

        const signed = Number(Number(sup.total_debt || 0).toFixed(2));
        const advAmt = signed < -0.009 ? Number(Math.abs(signed).toFixed(2)) : Number(Number(sup.advance_balance || 0).toFixed(2));
        const debtDue = signed > 0.009 ? signed : 0;

        if (s6a._onlyAdvancesFilter) {
          tr.style.display = advAmt > 0.009 ? '' : 'none';
        }

        // أ) عرض شارة التسبقة خارجياً أمام عمود الدين المتبقي للمورد
        const targetDebtTd = debtColIdx >= 0 && tds[debtColIdx] ? tds[debtColIdx] : null;
        if (targetDebtTd) {
          const expectedKey = debtDue.toFixed(2) + ':' + advAmt.toFixed(2);
          if (targetDebtTd.dataset.s6bDebtKey !== expectedKey) {
            targetDebtTd.dataset.s6bDebtKey = expectedKey;
            if (advAmt > 0.009) {
              targetDebtTd.innerHTML =
                '<div style="display:flex;flex-direction:column;align-items:flex-start;gap:3px;">' +
                  '<span style="font-family:monospace;font-weight:900;color:#059669;font-size:11px;">0.00 د.ج</span>' +
                  '<span data-s6b-advance-badge="1" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:linear-gradient(135deg,#0284c7,#2563eb);color:#ffffff;font-size:10.5px;font-weight:900;white-space:nowrap;box-shadow:0 2px 6px rgba(37,99,235,0.25);">' +
                    '💎 تسبقة لنا: ' + fmtNum(advAmt) +
                  '</span>' +
                '</div>';
            } else if (debtDue <= 0.009) {
              targetDebtTd.innerHTML =
                '<div style="display:flex;align-items:center;gap:5px;">' +
                  '<span style="font-family:monospace;font-weight:900;color:#059669;">0.00 د.ج</span>' +
                  '<span style="font-size:10px;font-weight:800;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;padding:1px 6px;border-radius:999px;">خالص</span>' +
                '</div>';
            }
          }
        }

        // ب) توحيد زر الإجراء على 100% من الصفوف
        const payBtn = Array.from(tr.querySelectorAll('button')).find((b) => {
          const txt = b.textContent || '';
          const oc = (typeof b.getAttribute === 'function' ? b.getAttribute('onclick') : '') || '';
          return /openSupplierPaymentModal/.test(oc) || /تسديد|خالص|تسبقة/.test(txt);
        });
        if (payBtn) {
          const btnKey = debtDue > 0.009 ? 'debt' : advAmt > 0.009 ? 'adv' : 'clean';
          if (payBtn.dataset.s6bBtnKey !== btnKey) {
            payBtn.dataset.s6bBtnKey = btnKey;
            if (btnKey === 'adv') {
              payBtn.innerHTML = '💎 + تسبقة';
              payBtn.title = 'لدينا تسبقة (' + fmtNum(advAmt) + ') — اضغط لإضافة تسبقة جديدة';
              payBtn.style.background = '#e0f2fe';
              payBtn.style.color = '#0369a1';
              payBtn.style.border = '1px solid #7dd3fc';
            } else if (btnKey === 'clean') {
              payBtn.innerHTML = '✅ خالص <span style="opacity:0.8;font-size:10px;">(تسبقة)</span>';
              payBtn.title = 'لا يوجد دين مستحق — اضغط فقط إذا أردت تسجيل تسبقة (Avance) لهذا المورد';
              payBtn.style.background = '#e2e8f0';
              payBtn.style.color = '#334155';
              payBtn.style.border = '1px solid #cbd5e1';
            } else {
              payBtn.innerHTML = '💵 تسديد';
              payBtn.style.background = '';
              payBtn.style.color = '';
              payBtn.style.border = '';
            }
          }
        }
      });

      // سطر إجمالي التسبقات داخل البطاقة العلوية الحمراء
      const allCards = Array.from(view.querySelectorAll('div')).filter((d) => {
        const t = d.textContent || '';
        return t.includes('إجمالي الديون المستحقة للموردين') && d.querySelectorAll('div').length < 10;
      });
      const debtKpiCard = allCards[allCards.length - 1];
      if (debtKpiCard) {
        let advPill = debtKpiCard.querySelector('#s6bSupTotalAdvancesPill');
        if (totalAdvancesSum > 0.009) {
          if (!advPill) {
            advPill = document.createElement('div');
            advPill.id = 's6bSupTotalAdvancesPill';
            advPill.style.cssText = 'margin-top:6px;padding:3px 9px;border-radius:999px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.45);color:#ffffff;font-size:11px;font-weight:900;display:inline-flex;align-items:center;gap:5px;';
            debtKpiCard.appendChild(advPill);
          }
          advPill.textContent = '💎 تسبقات لنا عند الموردين: ' + fmtNum(totalAdvancesSum) + ' (' + advancesCount + ')';
        } else if (advPill) {
          advPill.remove();
        }
      }

      // زر فلتر "💎 لديهم تسبقة (N)"
      const cleanFilterBtn = Array.from(view.querySelectorAll('button')).find((b) => /حسابهم خالص/.test(b.textContent || ''));
      if (cleanFilterBtn && cleanFilterBtn.parentNode) {
        let advFilterBtn = view.querySelector('#s6bSupAdvancesFilterBtn');
        if (!advFilterBtn) {
          advFilterBtn = document.createElement('button');
          advFilterBtn.id = 's6bSupAdvancesFilterBtn';
          advFilterBtn.type = 'button';
          advFilterBtn.style.cssText = 'padding:5px 11px;border-radius:999px;font-size:11px;font-weight:900;border:1.5px solid #38bdf8;background:#e0f2fe;color:#0369a1;cursor:pointer;white-space:nowrap;';
          advFilterBtn.addEventListener('click', () => {
            s6a._onlyAdvancesFilter = !s6a._onlyAdvancesFilter;
            advFilterBtn.style.background = s6a._onlyAdvancesFilter ? '#0284c7' : '#e0f2fe';
            advFilterBtn.style.color = s6a._onlyAdvancesFilter ? '#ffffff' : '#0369a1';
            const rowsNow = Array.from(view.querySelectorAll('tbody tr'));
            if (!s6a._onlyAdvancesFilter) rowsNow.forEach((r) => { r.style.display = ''; });
            s6a.enhanceSuppliersTableButtons();
          });
          cleanFilterBtn.parentNode.insertBefore(advFilterBtn, cleanFilterBtn.nextSibling);

          Array.from(cleanFilterBtn.parentNode.querySelectorAll('button')).forEach((ob) => {
            if (ob.id === 's6bSupAdvancesFilterBtn' || ob.dataset.s6bResetWired) return;
            ob.dataset.s6bResetWired = '1';
            ob.addEventListener('click', () => {
              s6a._onlyAdvancesFilter = false;
              advFilterBtn.style.background = '#e0f2fe';
              advFilterBtn.style.color = '#0369a1';
            });
          });
        }
        advFilterBtn.textContent = '💎 لديهم تسبقة (' + advancesCount + ')';
      }
    };

    setTimeout(() => s6a.enhanceSuppliersTableButtons(), 120);
    return true;
  }

  if (!patchStage6A()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (patchStage6A() || k >= 30) clearInterval(iv);
    }, 100);
  }
})();
