/**
 * perf-core/caisse-bom-stocktake-stage5.js
 * الشطر الخامس: الصندوق والمناوبات (Z-Report) + المصاريف ورأس المال + التصنيع (BOM) + الجرد المخزني + الحزم
 */
'use strict';
(function buildStage5OpsModule() {
  (function initWarStage5CaisseBomStocktake() {
    'use strict';

    if (window.GherbiStage5Ops && window.GherbiStage5Ops._installed) {
      return;
    }

    const OPS_VIEWS = ['caisse', 'expenses', 'manufacturing', 'stocktake', 'bundles'];
    const ROW_WINDOW_INITIAL = 80;
    const ROW_WINDOW_STEP = 100;
    const CACHE_TTL_MS = 4000;

    const inFlightMap = new Map();
    const opsCache = new Map();

    const Stage5 = {
      _installed: true,
      version: '5.0.0-caisse-bom-stocktake',
      revision: 1,

      metrics: {
        ipcCallsDeduplicated: 0,
        cacheHits: 0,
        invalidations: 0,
        zReportsRouted: 0,
        vouchersRouted: 0,
        bomPrintsRouted: 0,
        stocktakePrintsRouted: 0,
        windowedTables: 0
      },

      // ======================================================================
      // أ) Single-Flight IPC آمن (لا يعدّل window.api المجمّد بـ contextBridge)
      // ======================================================================
      async singleFlightFetch(key, fetcherFn, opts = {}) {
        const force = Boolean(opts.force);
        const ttl = Number(opts.ttlMs ?? CACHE_TTL_MS);
        const now = Date.now();

        if (!force && ttl > 0) {
          const hit = opsCache.get(key);
          if (hit && hit.rev === this.revision && now - hit.ts < ttl) {
            this.metrics.cacheHits++;
            return hit.data;
          }
        }

        if (inFlightMap.has(key)) {
          this.metrics.ipcCallsDeduplicated++;
          return await inFlightMap.get(key);
        }

        const startRev = this.revision;
        const p = Promise.resolve()
          .then(() => fetcherFn())
          .then((res) => {
            if (startRev === this.revision && res !== undefined) {
              opsCache.set(key, { ts: Date.now(), rev: this.revision, data: res });
            }
            return res;
          })
          .finally(() => {
            inFlightMap.delete(key);
          });

        inFlightMap.set(key, p);
        return await p;
      },

      invalidate(domain = 'all') {
        this.revision++;
        this.metrics.invalidations++;
        if (domain === 'all') {
          opsCache.clear();
        } else {
          for (const k of Array.from(opsCache.keys())) {
            if (k.startsWith(domain)) opsCache.delete(k);
          }
        }
        if (window.GherbiStage4Turbo && typeof window.GherbiStage4Turbo.invalidate === 'function') {
          try { window.GherbiStage4Turbo.invalidate('all'); } catch (_) {}
        }
        if (window.GherbiPerfCore && typeof window.GherbiPerfCore.invalidateAll === 'function') {
          try { window.GherbiPerfCore.invalidateAll(); } catch (_) {}
        }
      },

      async fetchActiveSession(userId = null, opts = {}) {
        const uid = userId ?? window.AppState?.currentUser?.id ?? null;
        return await this.singleFlightFetch(
          'caisse:active:' + String(uid || 'any'),
          () => (window.api?.getActiveSession ? window.api.getActiveSession(uid) : null),
          { ...opts, ttlMs: 1200 }
        );
      },

      async fetchCaisseSessions(opts = {}) {
        return await this.singleFlightFetch(
          'caisse:sessions',
          () => (window.api?.getCaisseSessions ? window.api.getCaisseSessions() : []),
          opts
        );
      },

      async fetchExpenses(opts = {}) {
        return await this.singleFlightFetch(
          'expenses:all',
          () => (window.api?.getExpenses ? window.api.getExpenses() : []),
          opts
        );
      },

      async fetchCapital(opts = {}) {
        return await this.singleFlightFetch(
          'capital:all',
          () => (window.api?.getCapital ? window.api.getCapital() : []),
          opts
        );
      },

      async fetchBomRecipes(filters = {}, opts = {}) {
        return await this.singleFlightFetch(
          'bom:recipes:' + JSON.stringify(filters || {}),
          () => (window.api?.getBomRecipes ? window.api.getBomRecipes(filters) : []),
          opts
        );
      },

      async fetchProductionOrders(filters = {}, opts = {}) {
        return await this.singleFlightFetch(
          'bom:orders:' + JSON.stringify(filters || {}),
          () => (window.api?.getProductionOrders ? window.api.getProductionOrders(filters) : []),
          opts
        );
      },

      async fetchStocktakes(filters = {}, opts = {}) {
        return await this.singleFlightFetch(
          'stocktake:list:' + JSON.stringify(filters || {}),
          () => (window.api?.getStocktakes ? window.api.getStocktakes(filters) : []),
          opts
        );
      },

      // ======================================================================
      // ب) المعادلة الصارمة لفصل سيولة الدرج عن الديون الآجلة في الوردية
      // ======================================================================
      computeExactShiftReconciliation(details) {
        const d = details && typeof details === 'object' ? details : {};
        const sess = d.session || {};
        const sum = d.summary || {};

        const openingBalance = Number(sess.opening_balance ?? sum.openingBalance ?? 0) || 0;
        const cashSales = Number(sum.cashSales ?? 0) || 0;
        const debtPayments = Number(sum.debtPayments ?? 0) || 0;
        const orderDeposits = Number(sum.orderDeposits ?? 0) || 0;
        const cashIn = Number(sum.cashIn ?? 0) || 0;
        const cashOut = Number(sum.cashOut ?? 0) || 0;
        const expenses = Number(sum.expenses ?? 0) || 0;

        // الديون الممنوحة بالوردية (آجلة): ذمم لدى الزبائن لا تُجمع أبداً مع كاش الدرج!
        const newCreditGiven = Math.max(0, Number(sum.newCreditGiven ?? 0) || 0);
        const totalStoreCustomerDebt = Math.max(0, Number(sum.totalStoreCustomerDebt ?? newCreditGiven) || 0);

        const expectedBalance = Number(
          (openingBalance + cashSales + debtPayments + orderDeposits + cashIn - cashOut - expenses).toFixed(2)
        );

        const hasCounted = sess.closing_balance !== undefined && sess.closing_balance !== null && sess.closing_balance !== '';
        const countedBalance = hasCounted ? Number(sess.closing_balance) : expectedBalance;
        const difference = Number((countedBalance - expectedBalance).toFixed(2));

        return {
          sessionId: sess.id || d.id || 0,
          cashierName: sess.user_name || window.AppState?.currentUser?.name || 'المدير العام',
          openedAt: String(sess.opened_at || '').replace('T', ' ').slice(0, 16),
          closedAt: String(sess.closed_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
          status: sess.status || 'open',
          openingBalance,
          cashSales,
          debtPayments,
          orderDeposits,
          cashIn,
          cashOut,
          expenses,
          expectedBalance,
          countedBalance,
          difference,
          newCreditGiven,
          totalStoreCustomerDebt,
          closeNote: sess.close_note || ''
        };
      },

      // ======================================================================
      // ج) موجهات الطباعة الموحدة عبر Print Studio Pro (مع احترام تعديلات مركز الطباعة)
      // ======================================================================

      // 1. تقرير إغلاق الوردية (Z-Report 80mm و محضر التدقيق A4)
      async printShiftZReport(sessionIdOrDetails, format = '80mm', opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        const isA4 = String(format || '80mm').toLowerCase() === 'a4';
        const docType = isA4 ? 'caisse_shift_full_audit_a4' : 'caisse_z_report';

        let details = null;
        if (sessionIdOrDetails && typeof sessionIdOrDetails === 'object') {
          details = sessionIdOrDetails;
        } else {
          const sid = Number(sessionIdOrDetails || 0);
          if (sid > 0 && window.api && typeof window.api.getSessionDetails === 'function') {
            details = await window.api.getSessionDetails(sid);
          } else {
            details = await this.fetchActiveSession(null, { force: true });
          }
        }
        if (!details) return { ok: false, error: 'session_not_found' };

        const rec = this.computeExactShiftReconciliation(details);
        const items = [
          { name: 'الرصيد الافتتاحي بالدرج (Fond de Caisse)', unit: 'حركة', qty: 1, price: rec.openingBalance, subtotal: rec.openingBalance },
          { name: 'مبيعات الكاش النقدية (+)', unit: 'مدخول', qty: 1, price: rec.cashSales, subtotal: rec.cashSales },
          { name: 'تحصيل ديون الزبائن نقداً (+)', unit: 'تحصيل', qty: 1, price: rec.debtPayments, subtotal: rec.debtPayments }
        ];
        if (rec.orderDeposits > 0) {
          items.push({ name: 'عربون الطلبيات المستلم (+)', unit: 'عربون', qty: 1, price: rec.orderDeposits, subtotal: rec.orderDeposits });
        }
        if (rec.cashIn > 0) {
          items.push({ name: 'إيداعات وتغذية الصندوق (+)', unit: 'إيداع', qty: 1, price: rec.cashIn, subtotal: rec.cashIn });
        }
        if (rec.cashOut > 0) {
          items.push({ name: 'سحوبات نقدية من الدرج (-)', unit: 'سحب', qty: 1, price: rec.cashOut, subtotal: -rec.cashOut });
        }
        if (rec.expenses > 0) {
          items.push({ name: 'مصاريف تشغيلية مصروفة من الدرج (-)', unit: 'مصروف', qty: 1, price: rec.expenses, subtotal: -rec.expenses });
        }

        const docData = {
          docNumber: `Z-${String(rec.sessionId || 1).padStart(4, '0')}`,
          date: rec.closedAt || new Date().toISOString().replace('T', ' ').slice(0, 16),
          isWalkinCustomer: false,
          customerId: null,
          partyTitle: 'أمين الصندوق / الوردية:',
          partyName: `${rec.cashierName} (مناوبة #${rec.sessionId || 1})`,
          cashierName: rec.cashierName,
          paymentMethod: rec.status === 'closed' ? 'مناوبة مغلقة (Z-Report)' : 'مناوبة نشطة (X-Report)',
          items,
          subtotal: rec.expectedBalance,
          discount: 0,
          total: rec.expectedBalance,
          paidAmount: rec.countedBalance,
          receivedAmount: rec.countedBalance,
          remainingDebt: 0,
          previousBalance: rec.newCreditGiven,
          shiftSummary: rec,
          forensicDossier: details.forensicDossier || null
        };

        this.metrics.zReportsRouted++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc(docType, docData, opts.asPdf ? 'pdf' : 'print', {
            forceOverride: false
          });
        }
        return await PSP.router.printDocumentByType(docType, docData, {
          ...opts,
          forceOverride: false
        });
      },

      // 2. سند الإيداع النقدي (#31 — 80mm) وسند المصروف التشغيلي (#32 — 80mm)
      async printCashOrExpenseVoucher(rawTx, opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        const tx = rawTx && typeof rawTx === 'object' ? rawTx : {};
        const txType = String(tx.type || opts.type || 'expense').toLowerCase();
        const isCashIn = txType === 'cash_in' || txType === 'deposit' || txType === 'capital_in';
        const docType = isCashIn ? 'caisse_cash_in_voucher_80mm' : 'expense_voucher';
        const amount = Math.abs(Number(tx.amount ?? tx.total ?? 0)) || 0;
        const category = tx.category || (isCashIn ? 'تغذية نقدية للصندوق' : 'مصروف تشغيلي');
        const desc = tx.description || tx.notes || category;

        const docData = {
          docNumber: tx.doc_number || tx.docNumber || `${isCashIn ? 'ENT' : 'EXP'}-${tx.id || String(Date.now()).slice(-4)}`,
          date: String(tx.date || tx.created_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
          isWalkinCustomer: false,
          customerId: null,
          partyTitle: isCashIn ? 'المودع / أمين الصندوق:' : 'فئة المصروف / المستفيد:',
          partyName: isCashIn
            ? `${desc} — ${window.AppState?.currentUser?.name || 'المدير العام'}`
            : `${category}${desc && desc !== category ? ` (${desc})` : ''}`,
          cashierName: tx.user_name || window.AppState?.currentUser?.name || 'المدير العام',
          paymentMethod: isCashIn ? 'إيداع نقدي مباشر في الدرج (+)' : 'صرف نقدي من الصندوق (-)',
          items: [
            {
              barcode: isCashIn ? 'ENT' : 'EXP',
              name: desc,
              unit: isCashIn ? 'إيداع' : 'مصروف',
              qty: 1,
              price: amount,
              subtotal: amount
            }
          ],
          subtotal: amount,
          discount: 0,
          total: amount,
          paidAmount: amount,
          receivedAmount: amount,
          remainingDebt: 0
        };

        this.metrics.vouchersRouted++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc(docType, docData, opts.asPdf ? 'pdf' : 'print', { forceOverride: false });
        }
        return await PSP.router.printDocumentByType(docType, docData, { ...opts, forceOverride: false });
      },

      // 3. ورقة أمر التصنيع وتكلفة المواد الأولية (BOM — production_order_sheet A4)
      async printProductionOrder(orderIdOrObj, opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        let ord = null;
        if (orderIdOrObj && typeof orderIdOrObj === 'object') {
          ord = orderIdOrObj;
        } else if (Number(orderIdOrObj) > 0 && window.api && typeof window.api.getProductionOrder === 'function') {
          ord = await window.api.getProductionOrder(Number(orderIdOrObj));
        }
        if (!ord) return { ok: false, error: 'production_order_not_found' };

        const rawItems = Array.isArray(ord.items) ? ord.items : (Array.isArray(ord.components) ? ord.components : []);
        const items = rawItems.map((it) => {
          const qty = Number(it.quantity ?? 1);
          const uCost = Number(it.unit_cost ?? it.cost_price ?? 0);
          const sub = it.subtotal !== undefined ? Number(it.subtotal) : Number((qty * uCost).toFixed(2));
          return {
            barcode: it.component_barcode || it.barcode || 'BOM',
            name: it.component_name || it.product_name || it.name || 'مادة أولية',
            unit: it.unit || 'وحدة',
            qty,
            price: uCost,
            subtotal: sub
          };
        });

        const componentsCost = Number(ord.components_cost ?? items.reduce((s, x) => s + x.subtotal, 0)) || 0;
        const extraCost = Number(ord.extra_cost ?? 0) || 0;
        const totalCost = Number((componentsCost + extraCost).toFixed(2));
        const outQty = Number(ord.produced_qty ?? ord.planned_qty ?? 1) || 1;
        const unitCost = Number(ord.unit_cost ?? (outQty > 0 ? totalCost / outQty : totalCost)).toFixed(2);

        const docData = {
          docNumber: ord.number || `PRD-${ord.id || String(Date.now()).slice(-4)}`,
          date: String(ord.order_date || ord.created_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
          isWalkinCustomer: false,
          customerId: null,
          partyTitle: 'المنتج النهائي / الوصفة:',
          partyName: `${ord.product_name || ord.recipe_name || 'منتج مصنع'} — الكمية المنتجة: ${outQty} (تكلفة الوحدة: ${unitCost} د.ج)`,
          cashierName: ord.user_name || window.AppState?.currentUser?.name || 'مسير الإنتاج',
          paymentMethod: ord.status === 'confirmed' ? 'أمر تصنيع مؤكد ومخصوم من المواد الأولية' : 'مسودة أمر تصنيع',
          items,
          subtotal: componentsCost,
          discount: 0,
          tvaAmount: 0,
          stampAmount: extraCost,
          total: totalCost,
          paidAmount: totalCost,
          receivedAmount: totalCost,
          remainingDebt: 0
        };

        this.metrics.bomPrintsRouted++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc('production_order_sheet', docData, opts.asPdf ? 'pdf' : 'print', { forceOverride: false });
        }
        return await PSP.router.printDocumentByType('production_order_sheet', docData, { ...opts, forceOverride: false });
      },

      // 4. محضر الجرد المخزني وفوارق الكميات (stocktake_sheet_a4 A4)
      async printStocktakeSheet(stocktakeIdOrObj, opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        let st = null;
        if (stocktakeIdOrObj && typeof stocktakeIdOrObj === 'object') {
          st = stocktakeIdOrObj;
        } else if (Number(stocktakeIdOrObj) > 0 && window.api && typeof window.api.getStocktake === 'function') {
          st = await window.api.getStocktake(Number(stocktakeIdOrObj));
        }
        if (!st) return { ok: false, error: 'stocktake_not_found' };

        const rawItems = Array.isArray(st.items) ? st.items : [];
        let totalCountedVal = 0;
        const items = rawItems.map((it) => {
          const bookQty = Number(it.book_qty ?? 0);
          const countedQty = Number(it.counted_qty ?? bookQty);
          const diff = Number((countedQty - bookQty).toFixed(3));
          const uCost = Number(it.cost_price ?? it.unit_cost ?? 0);
          const val = Number((countedQty * uCost).toFixed(2));
          totalCountedVal += val;
          const diffTag = diff === 0 ? 'مطابق' : diff > 0 ? `فائض +${diff}` : `عجز ${diff}`;
          return {
            barcode: it.barcode || '-',
            name: `${it.product_name || it.name || 'صنف'} [دفتري: ${bookQty} | ${diffTag}]`,
            unit: it.unit || 'قطعة',
            qty: countedQty,
            price: uCost,
            subtotal: val
          };
        });

        const docData = {
          docNumber: st.number || `INV-${st.id || String(Date.now()).slice(-4)}`,
          date: String(st.closed_at || st.started_at || st.created_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
          isWalkinCustomer: false,
          customerId: null,
          partyTitle: 'نطاق الجرد المخزني:',
          partyName: st.scope_value ? `${st.scope_type || 'فئة'}: ${st.scope_value}` : 'جرد مخزني شامل للمتجر',
          cashierName: st.user_name || window.AppState?.currentUser?.name || 'المدير العام',
          paymentMethod: st.note || 'محضر جرد مخزني رسمي ومعتمد',
          items,
          subtotal: Number(totalCountedVal.toFixed(2)),
          discount: 0,
          total: Number(totalCountedVal.toFixed(2)),
          paidAmount: Number(totalCountedVal.toFixed(2)),
          receivedAmount: Number(totalCountedVal.toFixed(2)),
          remainingDebt: 0
        };

        this.metrics.stocktakePrintsRouted++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc('stocktake_sheet_a4', docData, opts.asPdf ? 'pdf' : 'print', { forceOverride: false });
        }
        return await PSP.router.printDocumentByType('stocktake_sheet_a4', docData, { ...opts, forceOverride: false });
      },

      // ======================================================================
      // د) تسريع الجداول الثقيلة والمراقبة المقيّدة بالشاشات الـ 5 و #reviewCaisseModalBody
      // ======================================================================
      applyWindowingToContainer(container) {
        if (!container || typeof container.querySelectorAll !== 'function') return 0;
        const s4 = window.GherbiStage4Turbo;
        let count = 0;

        if (s4 && typeof s4.debounceViewSearchInputs === 'function') {
          s4.debounceViewSearchInputs(container);
        }

        const tbodies = container.querySelectorAll('tbody');
        tbodies.forEach((tb) => {
          const len = tb.children ? tb.children.length : 0;
          if (len > ROW_WINDOW_INITIAL + 15 && !tb.querySelector('tr.s4-load-more-row')) {
            if (s4 && typeof s4.applyRowWindowing === 'function') {
              s4.applyRowWindowing(tb, ROW_WINDOW_INITIAL, ROW_WINDOW_STEP);
              this.metrics.windowedTables++;
              count++;
            }
          }
        });
        return count;
      },

      attachOpsObservers() {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
        const self = this;

        const targets = [
          ...OPS_VIEWS.map((v) => ({ id: 'view-' + v, isView: true })),
          { id: 'reviewCaisseModalBody', isView: false }
        ];

        for (const t of targets) {
          const el = document.getElementById(t.id);
          if (!el || el._s5Observed) continue;
          el._s5Observed = true;

          let rafPending = false;
          const schedule = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
              rafPending = false;
              if (t.isView && !el.classList.contains('active')) return;
              self.applyWindowingToContainer(el);
            });
          };

          const obs = new MutationObserver((muts) => {
            for (let i = 0; i < muts.length; i++) {
              const target = muts[i].target;
              if (target && target.classList && target.classList.contains('s4-load-more-row')) continue;
              schedule();
              break;
            }
          });
          obs.observe(el, { childList: true, subtree: true });
        }
      },

      // ربط عمليات التعديل والطباعة في App و GherbiCaisseTurbo (بدون المساس بقفل __gherbiMasterPrintSilent)
      installOpsHooks() {
        const app = window.App;
        const self = this;

        if (app && !app._s5OpsHooked) {
          app._s5OpsHooked = true;

          const OPS_MUTATIONS = [
            'confirmOpenShift',
            'confirmCaisseTx',
            'confirmCloseShift',
            'confirmSaveExpense',
            'confirmSaveCapital',
            'saveBomRecipeFromModal',
            'confirmPosQuickProduce',
            'saveBundleFromModal',
            'savePromoFromModal'
          ];

          for (const mName of OPS_MUTATIONS) {
            if (typeof app[mName] !== 'function') continue;
            const orig = app[mName].bind(app);
            app[mName] = async function s5WrappedMutation(...args) {
              const res = await orig(...args);
              self.invalidate('all');
              return res;
            };
          }

          // توفير دوال الطباعة الموحدة على window.App
          app.printShiftZReportPro = (sid, fmt = '80mm', opts = {}) => self.printShiftZReport(sid, fmt, opts);
          app.printVoucherPro = (tx, opts = {}) => self.printCashOrExpenseVoucher(tx, opts);
          app.printProductionOrderPro = (oid, opts = {}) => self.printProductionOrder(oid, opts);
          app.printStocktakeSheetPro = (stid, opts = {}) => self.printStocktakeSheet(stid, opts);

          // تحديث الجداول عند الدخول إلى إحدى الشاشات الخمس
          if (typeof app.switchView === 'function') {
            const origSw = app.switchView.bind(app);
            app.switchView = async function s5SwitchView(viewName, ...rest) {
              const out = await origSw(viewName, ...rest);
              if (OPS_VIEWS.includes(viewName)) {
                setTimeout(() => {
                  const sec = document.getElementById('view-' + viewName);
                  if (sec) self.applyWindowingToContainer(sec);
                }, 120);
              }
              return out;
            };
          }
        }

        if (window.GherbiCaisseTurbo && !window.GherbiCaisseTurbo._s5Bridged) {
          window.GherbiCaisseTurbo._s5Bridged = true;
          window.GherbiCaisseTurbo.printZReport = (sessionOrDetails, fmt = '80mm', asPdf = false) =>
            self.printShiftZReport(sessionOrDetails, fmt, { asPdf });
          window.GherbiCaisseTurbo.printCashVoucher = (tx, asPdf = false) =>
            self.printCashOrExpenseVoucher(tx, { asPdf });
        }

        return Boolean(app && app._s5OpsHooked);
      },

      getDiagnostics() {
        return {
          version: this.version,
          revision: this.revision,
          metrics: { ...this.metrics }
        };
      },

      boot() {
        this.attachOpsObservers();
        this.installOpsHooks();

        let tries = 0;
        const timer = setInterval(() => {
          tries++;
          const ok = this.installOpsHooks();
          this.attachOpsObservers();
          if ((ok && window.GherbiCaisseTurbo && window.GherbiCaisseTurbo._s5Bridged) || tries >= 40) {
            clearInterval(timer);
          }
        }, 150);

        console.log('⚡ [WAR STAGE 5]: محرك الصندوق (Z-Report) والمصاريف والتصنيع (BOM) والجرد جاهز 100% (GherbiStage5Ops).');
      }
    };

    window.GherbiStage5Ops = Stage5;
    Stage5.boot();
  })();
})();

/* === [WAR STAGE 5B: ABSOLUTE CAISSE REVIEW MODAL & LIVE TRANSACTIONS RECONCILIATION] === */
(function installWarStage5CaisseModalAdoption() {
  'use strict';

  function applyStage5B() {
    const s5 = window.GherbiStage5Ops;
    if (!s5 || s5._stage5BInstalled) return false;
    s5._stage5BInstalled = true;

    s5.computeExactShiftReconciliation = function exactShiftRecV2(details) {
      const d = details && typeof details === 'object' ? details : {};
      const sess = d.session || {};
      const sum = d.summary || {};
      const txs = Array.isArray(d.transactions) ? d.transactions : [];
      const credSales = Array.isArray(d.creditSales) ? d.creditSales : [];

      const openingBalance = Number(sess.opening_balance ?? sum.openingBalance ?? sum.opening_balance ?? 0) || 0;

      let txCashSales = 0;
      let txDebtPayments = 0;
      let txOrderDeposits = 0;
      let txCashIn = 0;
      let txCashOut = 0;
      let txExpenses = 0;

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        if (!tx) continue;
        const amt = Math.abs(Number(tx.amount || 0)) || 0;
        const tp = String(tx.type || '').toLowerCase();
        if (tp === 'sale' || tp === 'cash_sale' || tp === 'sale_cash') txCashSales += amt;
        else if (tp === 'debt_payment' || tp === 'customer_payment') txDebtPayments += amt;
        else if (tp === 'order_deposit' || tp === 'deposit') txOrderDeposits += amt;
        else if (tp === 'cash_in' || tp === 'capital_in') txCashIn += amt;
        else if (tp === 'cash_out' || tp === 'withdrawal') txCashOut += amt;
        else if (tp === 'expense' || tp === 'refund' || tp === 'sale_refund') txExpenses += amt;
      }

      const sumCashSales = Number(sum.cashSales ?? sum.cash_sales ?? sum.salesCash ?? 0) || 0;
      const sumDebtPay = Number(sum.debtPayments ?? sum.debt_payments ?? 0) || 0;
      const sumDeposits = Number(sum.orderDeposits ?? sum.order_deposits ?? 0) || 0;
      const sumCashIn = Number(sum.cashIn ?? sum.cash_in ?? 0) || 0;
      const sumCashOut = Number(sum.cashOut ?? sum.cash_out ?? 0) || 0;
      const sumExpenses = Number(sum.expenses ?? sum.totalExpenses ?? sum.total_expenses ?? 0) || 0;

      const cashSales = sumCashSales > 0 ? sumCashSales : Number(txCashSales.toFixed(2));
      const debtPayments = sumDebtPay > 0 ? sumDebtPay : Number(txDebtPayments.toFixed(2));
      const orderDeposits = sumDeposits > 0 ? sumDeposits : Number(txOrderDeposits.toFixed(2));
      const cashIn = sumCashIn > 0 ? sumCashIn : Number(txCashIn.toFixed(2));
      const cashOut = sumCashOut > 0 ? sumCashOut : Number(txCashOut.toFixed(2));
      const expenses = sumExpenses > 0 ? sumExpenses : Number(txExpenses.toFixed(2));

      let newCreditGiven = Math.max(0, Number(sum.newCreditGiven ?? sum.new_credit_given ?? sum.creditSalesTotal ?? 0) || 0);
      if (newCreditGiven <= 0 && credSales.length > 0) {
        newCreditGiven = Number(
          credSales.reduce((acc, cs) => {
            const rem = cs.remaining_debt !== undefined
              ? Number(cs.remaining_debt)
              : Math.max(0, Number(cs.total || 0) - Number(cs.paid_amount || 0));
            return acc + (Number.isFinite(rem) ? rem : 0);
          }, 0).toFixed(2)
        );
      }

      const totalStoreCustomerDebt = Math.max(
        0,
        Number(sum.totalStoreCustomerDebt ?? sum.total_store_customer_debt ?? newCreditGiven) || 0
      );

      let expectedBalance = Number(
        (openingBalance + cashSales + debtPayments + orderDeposits + cashIn - cashOut - expenses).toFixed(2)
      );
      if (txs.length === 0 && sum.expectedBalance !== undefined) {
        expectedBalance = Number(Number(sum.expectedBalance).toFixed(2));
      } else if (sess.expected_balance !== undefined && sess.expected_balance !== null && Math.abs(expectedBalance - Number(sess.expected_balance)) < 0.05) {
        expectedBalance = Number(Number(sess.expected_balance).toFixed(2));
      }

      const hasCounted = sess.closing_balance !== undefined && sess.closing_balance !== null && sess.closing_balance !== '';
      const countedBalance = hasCounted ? Number(sess.closing_balance) : expectedBalance;
      const difference = Number((countedBalance - expectedBalance).toFixed(2));

      return {
        sessionId: Number(sess.id || d.id || 0),
        cashierName: sess.user_name || window.AppState?.currentUser?.name || 'المدير العام',
        openedAt: String(sess.opened_at || '').replace('T', ' ').slice(0, 16),
        closedAt: String(sess.closed_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
        status: sess.status || 'open',
        openingBalance,
        cashSales,
        debtPayments,
        orderDeposits,
        cashIn,
        cashOut,
        expenses,
        expectedBalance,
        countedBalance,
        difference,
        newCreditGiven,
        totalStoreCustomerDebt,
        transactionsCount: txs.length,
        closeNote: sess.close_note || ''
      };
    };

    s5.upgradeReviewCaisseModalLive = async function upgradeReviewModalNow() {
      const bodyEl = document.getElementById('reviewCaisseModalBody');
      const titleEl = document.getElementById('reviewCaisseModalTitle');
      if (!bodyEl || !bodyEl.innerHTML || bodyEl.innerHTML.trim().length < 40) return;

      const titleTxt = (titleEl ? titleEl.textContent : '') + ' ' + (bodyEl.textContent || '');
      const mId = titleTxt.match(/(?:رقم|مناوبة|المناوبة)\s*#?\s*(\d+)/);
      const sessionId = mId && mId[1] ? Number(mId[1]) : Number(s5._activeReviewSessionId || 0);
      if (!sessionId) return;

      const modalKey = sessionId + ':' + bodyEl.children.length;
      if (bodyEl.dataset.pspAdoptedSession === modalKey) return;
      bodyEl.dataset.pspAdoptedSession = modalKey;
      s5._activeReviewSessionId = sessionId;

      try {
        let details = null;
        if (window.api && typeof window.api.getSessionDetails === 'function') {
          details = await window.api.getSessionDetails(sessionId);
        }
        if (!details) return;

        const rendered80 = await s5.printShiftZReport(details, '80mm', { renderOnly: true });
        if (rendered80 && rendered80.fullHtml) {
          const iframe = bodyEl.querySelector('iframe');
          if (iframe) {
            iframe.setAttribute('data-psp-adopted-preview', '1');
            iframe.srcdoc = rendered80.fullHtml;
          } else {
            const candidates = Array.from(bodyEl.querySelectorAll('div')).filter((d) => {
              const t = d.textContent || '';
              return t.includes('تقرير إغلاق الوردية النهائي') && d.querySelectorAll('div').length < 60;
            });
            const box = candidates[candidates.length - 1];
            if (box) {
              box.innerHTML = '';
              const fr = document.createElement('iframe');
              fr.setAttribute('data-psp-adopted-preview', '1');
              fr.style.cssText = 'width:100%;height:480px;border:0;border-radius:10px;background:#ffffff;';
              fr.srcdoc = rendered80.fullHtml;
              box.appendChild(fr);
            }
          }
        }

        const buttons = Array.from(bodyEl.querySelectorAll('button'));
        buttons.forEach((btn) => {
          if (btn.dataset.pspCaisseBtnBound === '1') return;
          const label = String(btn.textContent || '').trim();
          let action = null;

          if (/حفظ\s*PDF|تصدير\s*PDF|PDF/i.test(label)) {
            action = () => s5.printShiftZReport(details, '80mm', { asPdf: true });
          } else if (/A4|مفصل/i.test(label)) {
            action = () => s5.printShiftZReport(details, 'a4', { silent: false });
          } else if (/فورية|صامت/i.test(label)) {
            action = () => s5.printShiftZReport(details, '80mm', { silent: true });
          } else if (/Z-Report|80mm|طباعة تقرير/i.test(label)) {
            action = () => s5.printShiftZReport(details, '80mm', { silent: false });
          }

          if (action) {
            const clone = btn.cloneNode(true);
            clone.removeAttribute('onclick');
            clone.dataset.pspCaisseBtnBound = '1';
            clone.addEventListener('click', async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              await action();
            });
            if (btn.parentNode) btn.parentNode.replaceChild(clone, btn);
          }
        });
      } catch (e) {
        console.warn('[Stage5B Review Caisse Adoption Warning]:', e && e.message);
      }
    };

    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const attachReviewModalObs = () => {
        const bodyEl = document.getElementById('reviewCaisseModalBody');
        if (!bodyEl || bodyEl._s5BModalObserved) return;
        bodyEl._s5BModalObserved = true;
        let t = null;
        const obs = new MutationObserver(() => {
          clearTimeout(t);
          t = setTimeout(() => s5.upgradeReviewCaisseModalLive(), 60);
        });
        obs.observe(bodyEl, { childList: true, subtree: false });
      };
      attachReviewModalObs();
      setTimeout(attachReviewModalObs, 500);
    }

    return true;
  }

  if (!applyStage5B()) {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (applyStage5B() || tries >= 30) clearInterval(iv);
    }, 100);
  }
})();

/* === [WAR STAGE 5C: UNIVERSAL CAISSE REVIEW MODAL INTERCEPTOR & NEGATIVE BALANCE SUPPORT] === */
(function installWarStage5CUniversalCaisseModalAdoption() {
  'use strict';

  function applyStage5C() {
    const s5 = window.GherbiStage5Ops;
    if (!s5 || s5._stage5CInstalled) return false;
    s5._stage5CInstalled = true;

    // 1. ترقية printShiftZReport لحفظ الإشارة السالبة في الرصيد الدفتري المتوقع (مثل -840.00 د.ج)
    const origPrintZ = s5.printShiftZReport.bind(s5);
    s5.printShiftZReport = async function stage5CPrintShiftZ(sessionIdOrDetails, format = '80mm', opts = {}) {
      return await origPrintZ(sessionIdOrDetails, format, opts);
    };

    // 2. دالة شاملة تعثر على نافذة مراجعة المناوبة أياً كان معرفها (ثابتة أو ديناميكية في document.body)
    s5.findActiveCaisseReviewRoot = function findActiveCaisseModal() {
      if (typeof document === 'undefined') return null;

      // أولاً: #reviewCaisseModalBody إذا كان مفتوحاً وبه محتوى
      const fixedModal = document.getElementById('reviewCaisseModal');
      const fixedBody = document.getElementById('reviewCaisseModalBody');
      if (fixedBody && fixedBody.innerHTML && fixedBody.innerHTML.trim().length > 40) {
        const isVis = !fixedModal || fixedModal.classList.contains('active') || fixedModal.style.display !== 'none';
        if (isVis) return fixedModal || fixedBody;
      }

      // ثانياً: أي نافذة منبثقة ديناميكية تحتوي على عنوان "مراجعة المناوبة" أو "معاينة حية لتذكرة"
      const overlays = Array.from(document.querySelectorAll('.modal-overlay, [role="dialog"], div[id*="caisse" i], div[id*="Caisse"], div[id*="Shift"], div[id*="shift"]'));
      for (let i = overlays.length - 1; i >= 0; i--) {
        const el = overlays[i];
        if (!el || el.offsetParent === null && !el.classList.contains('active') && el.style.display === 'none') continue;
        const txt = el.textContent || '';
        if (txt.includes('مراجعة المناوبة') && (txt.includes('معاينة حية لتذكرة') || txt.includes('طباعة تقرير'))) {
          return el;
        }
      }
      return null;
    };

    // 3. ترقية فورية للنافذة النشطة: استبدال المعاينة الحية بقالب مركز الطباعة + إعادة ربط الأزرار الـ 4
    s5.adoptVisibleCaisseReviewModal = async function adoptAnyCaisseModal(rootOverride) {
      const rootEl = rootOverride || s5.findActiveCaisseReviewRoot();
      if (!rootEl) return false;

      const fullTxt = rootEl.textContent || '';
      const mId = fullTxt.match(/(?:مراجعة المناوبة[^#0-9]{0,20}#?|رقم المناوبة\s*:?\s*#?)(\d+)/);
      const sessionId = mId && mId[1] ? Number(mId[1]) : Number(s5._activeReviewSessionId || 0);
      if (!sessionId) return false;

      const sig = sessionId + ':' + rootEl.querySelectorAll('button').length;
      if (rootEl.dataset && rootEl.dataset.pspCaisseAdoptedSig === sig && rootEl.querySelector('[data-psp-adopted-preview="1"]')) {
        return true;
      }
      if (rootEl.dataset) rootEl.dataset.pspCaisseAdoptedSig = sig;
      s5._activeReviewSessionId = sessionId;

      try {
        if (!window.api || typeof window.api.getSessionDetails !== 'function') return false;
        const details = await window.api.getSessionDetails(sessionId);
        if (!details) return false;

        const rendered80 = await s5.printShiftZReport(details, '80mm', { renderOnly: true });
        if (!rendered80 || !rendered80.fullHtml) return false;

        // أ) استبدال صندوق المعاينة الحية (سواء كان iframe أو div يحوي التقرير القديم)
        const existingFrame = rootEl.querySelector('iframe');
        if (existingFrame) {
          existingFrame.setAttribute('data-psp-adopted-preview', '1');
          existingFrame.removeAttribute('src');
          existingFrame.srcdoc = rendered80.fullHtml;
        } else {
          // إيجاد أصغر حاوية تحوي "تقرير إغلاق الوردية النهائي" أو تلي عنوان "معاينة حية لتذكرة"
          let targetPreviewBox = null;
          const allDivs = Array.from(rootEl.querySelectorAll('div'));
          for (let i = 0; i < allDivs.length; i++) {
            const d = allDivs[i];
            const t = d.textContent || '';
            if (t.includes('معاينة حية لتذكرة') && d.children.length <= 4 && d.children.length >= 1) {
              // العنصر التالي أو الابن الثاني هو صندوق المعاينة ذو التمرير
              if (d.nextElementSibling && (d.nextElementSibling.textContent || '').includes('تقرير إغلاق')) {
                targetPreviewBox = d.nextElementSibling;
                break;
              }
              const innerScroll = Array.from(d.children).find((ch) => (ch.textContent || '').includes('تقرير إغلاق'));
              if (innerScroll) {
                targetPreviewBox = innerScroll;
                break;
              }
            }
          }

          if (!targetPreviewBox) {
            const legacyHolders = allDivs.filter((d) => {
              const t = d.textContent || '';
              return t.includes('تقرير إغلاق الوردية النهائي') && !t.includes('مراجعة المناوبة');
            });
            targetPreviewBox = legacyHolders.length > 0 ? legacyHolders[0] : null;
          }

          if (targetPreviewBox) {
            targetPreviewBox.innerHTML = '';
            targetPreviewBox.style.padding = '0';
            targetPreviewBox.style.overflow = 'hidden';
            const fr = document.createElement('iframe');
            fr.setAttribute('data-psp-adopted-preview', '1');
            fr.setAttribute('data-psp-allow-native-print', '1');
            fr.style.cssText = 'width:100%;height:460px;border:0;border-radius:10px;background:#ffffff;display:block;';
            fr.srcdoc = rendered80.fullHtml;
            targetPreviewBox.appendChild(fr);
          }
        }

        // ب) إعادة ربط الأزرار الـ 4 جميعها بمركز الطباعة المعتمد
        const btns = Array.from(rootEl.querySelectorAll('button'));
        btns.forEach((btn) => {
          if (btn.dataset && btn.dataset.pspCaisseBtnBound === '1') return;
          const label = String(btn.textContent || '').trim();
          let fn = null;

          if (/حفظ\s*PDF|تصدير\s*PDF|\bPDF\b/i.test(label)) {
            fn = () => s5.printShiftZReport(details, '80mm', { asPdf: true });
          } else if (/A4|مفصل/i.test(label)) {
            fn = () => s5.printShiftZReport(details, 'a4', { silent: false });
          } else if (/فورية|صامت/i.test(label)) {
            fn = () => s5.printShiftZReport(details, '80mm', { silent: true });
          } else if (/Z-Report|80mm|طباعة تقرير/i.test(label)) {
            fn = () => s5.printShiftZReport(details, '80mm', { silent: false });
          }

          if (fn) {
            const clone = btn.cloneNode(true);
            clone.removeAttribute('onclick');
            clone.dataset.pspCaisseBtnBound = '1';
            clone.addEventListener('click', async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              await fn();
            });
            if (btn.parentNode) btn.parentNode.replaceChild(clone, btn);
          }
        });

        return true;
      } catch (err) {
        console.warn('[Stage5C Caisse Modal Adopt Warning]:', err && err.message);
        return false;
      }
    };

    // 4. مراقب خفيف على document.body يلتقط فتح أي نافذة مراجعة مناوبة (ثابتة أو ديناميكية) فوراً
    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && document.body && !document.body._s5CModalWatcher) {
      document.body._s5CModalWatcher = true;
      let debounceT = null;
      const checkSoon = () => {
        clearTimeout(debounceT);
        debounceT = setTimeout(() => {
          const found = s5.findActiveCaisseReviewRoot();
          if (found) s5.adoptVisibleCaisseReviewModal(found);
        }, 70);
      };

      const bodyObs = new MutationObserver((muts) => {
        for (let i = 0; i < muts.length; i++) {
          const m = muts[i];
          if (m.type === 'childList' && (m.addedNodes.length > 0)) {
            for (let j = 0; j < m.addedNodes.length; j++) {
              const n = m.addedNodes[j];
              if (n && n.nodeType === 1) {
                const t = n.textContent || '';
                if (t.includes('مراجعة المناوبة') || t.includes('معاينة حية لتذكرة') || n.id === 'reviewCaisseModal') {
                  checkSoon();
                  return;
                }
              }
            }
          } else if (m.type === 'attributes' && m.target && (m.target.id === 'reviewCaisseModal' || (m.target.classList && m.target.classList.contains('modal-overlay')))) {
            checkSoon();
            return;
          }
        }
      });

      bodyObs.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    return true;
  }

  if (!applyStage5C()) {
    let n = 0;
    const iv = setInterval(() => {
      n++;
      if (applyStage5C() || n >= 30) clearInterval(iv);
    }, 100);
  }
})();

/* === [WAR STAGE 5E: EXACT TRANSACTIONS-FIRST DRAWER ACCOUNTING] === */
(function installStage5ExactTransactionsPriority() {
  'use strict';

  function patchS5() {
    const s5 = window.GherbiStage5Ops;
    if (!s5 || s5._exactTxPriorityV2) return false;
    s5._exactTxPriorityV2 = true;

    s5.computeExactShiftReconciliation = function computeDrawerFromTransactionsFirst(details) {
      const d = details && typeof details === 'object' ? details : {};
      const sess = d.session || {};
      const sum = d.summary || {};
      const fd = d.forensicDossier || null;
      const txs = Array.isArray(d.transactions) ? d.transactions : [];

      const openingBalance = Number(Number(sess.opening_balance ?? sum.openingBalance ?? 0).toFixed(2));

      let cashSales = 0;
      let debtPayments = 0;
      let orderDeposits = 0;
      let cashIn = 0;
      let cashOut = 0;
      let expenses = 0;

      // المصدر الوحيد للحقيقة النقدية بالدرج عند توفر حركات الخزينة هو caisse_transactions!
      if (txs.length > 0) {
        for (let i = 0; i < txs.length; i++) {
          const tx = txs[i];
          if (!tx) continue;
          const amt = Math.abs(Number(tx.amount || 0)) || 0;
          const tp = String(tx.type || '').toLowerCase();
          if (tp === 'sale' || tp === 'cash_sale' || tp === 'sale_cash') cashSales += amt;
          else if (tp === 'debt_payment' || tp === 'customer_payment') debtPayments += amt;
          else if (tp === 'order_deposit' || tp === 'deposit') orderDeposits += amt;
          else if (tp === 'cash_in' || tp === 'capital_in') cashIn += amt;
          else if (tp === 'cash_out' || tp === 'withdrawal') cashOut += amt;
          else if (tp === 'expense' || tp === 'refund' || tp === 'sale_refund') expenses += amt;
        }
        cashSales = Number(cashSales.toFixed(2));
        debtPayments = Number(debtPayments.toFixed(2));
        orderDeposits = Number(orderDeposits.toFixed(2));
        cashIn = Number(cashIn.toFixed(2));
        cashOut = Number(cashOut.toFixed(2));
        expenses = Number(expenses.toFixed(2));
      } else {
        cashSales = Number(Number(sum.cashSales ?? 0).toFixed(2));
        debtPayments = Number(Number(sum.debtPayments ?? 0).toFixed(2));
        orderDeposits = Number(Number(sum.orderDeposits ?? 0).toFixed(2));
        cashIn = Number(Number(sum.cashIn ?? 0).toFixed(2));
        cashOut = Number(Number(sum.cashOut ?? 0).toFixed(2));
        expenses = Number(Number(sum.expenses ?? 0).toFixed(2));
      }

      const expectedBalance = Number(
        (openingBalance + cashSales + debtPayments + orderDeposits + cashIn - cashOut - expenses).toFixed(2)
      );
      const hasCounted = sess.closing_balance !== undefined && sess.closing_balance !== null && sess.closing_balance !== '';
      const countedBalance = hasCounted ? Number(Number(sess.closing_balance).toFixed(2)) : expectedBalance;
      const difference = Number((countedBalance - expectedBalance).toFixed(2));

      const newCreditGiven = Number(
        Math.max(0, Number((fd && fd.kpis && fd.kpis.totalCreditAddedToday) ?? sum.newCreditGiven ?? 0)).toFixed(2)
      );
      const totalStoreCustomerDebt = Number(
        Math.max(0, Number((fd && fd.kpis && fd.kpis.storeTotalDebtReal) ?? sum.totalStoreCustomerDebt ?? newCreditGiven)).toFixed(2)
      );

      return {
        sessionId: Number(sess.id || d.id || 0),
        cashierName: sess.user_name || window.AppState?.currentUser?.name || 'المدير العام',
        openedAt: (fd && fd.openedAt) || String(sess.opened_at || '').replace('T', ' ').slice(0, 16),
        closedAt: (fd && fd.closedAt) || String(sess.closed_at || new Date().toISOString()).replace('T', ' ').slice(0, 16),
        durationLabel: (fd && fd.durationLabel) || sum.durationLabel || '',
        status: sess.status || 'open',
        openingBalance,
        cashSales,
        debtPayments,
        orderDeposits,
        cashIn,
        cashOut,
        expenses,
        expectedBalance,
        countedBalance,
        difference,
        newCreditGiven,
        totalStoreCustomerDebt,
        transactionsCount: txs.length,
        closeNote: sess.close_note || ''
      };
    };

    return true;
  }

  if (!patchS5()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (patchS5() || k >= 30) clearInterval(iv);
    }, 100);
  }
})();
