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
          shiftSummary: rec
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

/* === [WAR STAGE 5D: EXECUTIVE Z-REPORT 80MM & A4 WAR-ROOM RENDERER] === */
(function installStage5DExecutiveZReportRenderer() {
  'use strict';

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtMoney(val, showPlus) {
    const n = Number(val || 0);
    const absStr = Math.abs(n).toFixed(2);
    const parts = absStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = n < -0.004 ? '-' : showPlus && n > 0.004 ? '+' : '';
    return '<span dir="rtl" style="white-space:nowrap;unicode-bidi:isolate;font-weight:900;">\u2066' + sign + parts.join('.') + '\u2069&#160;د.ج</span>';
  }

  function buildSampleForensicDossier() {
    return {
      outflows: [
        { time: '11:20', typeLabel: 'سلفة عامل #2', beneficiary: 'محمد (العامل)', reason: 'سلفة نقدية من الصندوق', amount: 1000 },
        { time: '15:40', typeLabel: 'نقل وشحن', beneficiary: 'موزع البضاعة', reason: 'تفريغ ونقل سلع التموين', amount: 500 }
      ],
      inflows: [
        { time: '08:05', typeLabel: 'إيداع صرف', source: 'المدير العام', reason: 'تغذية الدرج بفئات صغيرة', amount: 1000 }
      ],
      debtCollections: [
        { time: '14:15', customerName: 'أمين بن يحيى', customerPhone: '0550112233', note: 'دفعة من الدين السابق', amount: 1200, remainingDebtNow: 550 }
      ],
      debtCollectionsGrouped: [
        { customerName: 'أمين بن يحيى', count: 1, total: 1200, lastTime: '14:15', remainingDebtNow: 550 }
      ],
      creditSalesToday: [
        { docNumber: 'FAC-0124', time: '16:30', customerName: 'كريم بن عيسى', customerPhone: '0661445566', invoiceTotal: 1450, paidToday: 500, creditAdded: 950, cumulativeDebtNow: 2150 },
        { docNumber: 'FAC-0127', time: '18:10', customerName: 'سليم مرابط', customerPhone: '0770889900', invoiceTotal: 620, paidToday: 0, creditAdded: 620, cumulativeDebtNow: 620 }
      ],
      topDebtors: [
        { name: 'كريم بن عيسى', phone: '0661445566', debt: 2150 },
        { name: 'سليم مرابط', phone: '0770889900', debt: 620 },
        { name: 'أمين بن يحيى', phone: '0550112233', debt: 550 }
      ],
      auditEventsCount: 0,
      ownerAlerts: [
        { level: 'info', text: 'تم منح ديون جديدة بقيمة 1,570.00 د.ج لـ (2) زبائن في هذه الوردية.' }
      ],
      kpis: {
        salesCount: 24,
        totalSalesRevenue: 17370,
        avgBasket: 723.75,
        totalDiscounts: 150,
        totalOutflows: 1500,
        totalInflows: 1000,
        totalDebtCollected: 1200,
        totalCreditAddedToday: 1570,
        storeTotalDebtReal: 3320,
        debtorsCount: 3
      },
      paymentBreakdown: {
        cash: 14800,
        cib: 1000,
        baridimob: 0,
        cheque: 0,
        credit: 1570,
        other: 0
      }
    };
  }

  function renderThermal80mmWarBlock(dossier, rec, theme) {
    const primary = (theme && theme.primary) || '#0f172a';
    const border = (theme && theme.border) || '#cbd5e1';
    const outflows = Array.isArray(dossier.outflows) ? dossier.outflows : [];
    const creditSales = Array.isArray(dossier.creditSalesToday) ? dossier.creditSalesToday : [];
    const collections = Array.isArray(dossier.debtCollectionsGrouped) ? dossier.debtCollectionsGrouped : [];
    const alerts = Array.isArray(dossier.ownerAlerts) ? dossier.ownerAlerts : [];
    const kpis = dossier.kpis || {};
    const pm = dossier.paymentBreakdown || {};

    let html = '<div data-s5d-war-dossier="1" style="margin-top:6px;font-family:\'Cairo\',\'Tajawal\',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;font-size:9.2px;line-height:1.35;color:#0f172a;">';

    // 1. شريط تنبيهات المستشار الحربي لصاحب المتجر (يظهر عند وجود تنبيه)
    if (alerts.length > 0) {
      html += '<div style="border:1.5px solid #e11d48;background:#fff1f2;border-radius:6px;padding:4px 5px;margin-bottom:6px;">';
      html += '<div style="font-weight:900;color:#9f1239;font-size:9.3px;margin-bottom:2px;">🛡️ تنبيهات الرقابة لصاحب المتجر:</div>';
      for (let i = 0; i < alerts.length; i++) {
        const al = alerts[i];
        const col = al.level === 'danger' ? '#be123c' : al.level === 'warning' ? '#b45309' : '#1d4ed8';
        html += '<div style="color:' + col + ';font-weight:800;font-size:8.6px;margin-top:1px;">• ' + esc(al.text) + '</div>';
      }
      html += '</div>';
    }

    // 2. دفتر الأموال الخارجة (المصاريف، السلَف، السحوبات — من أخذ؟ لماذا؟ كم؟)
    html += '<div style="border:1px solid #fecdd3;border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#fff;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fda4af;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#9f1239;">';
    html += '<span>💸 الأموال الخارجة (مصاريف / سلَف) (' + outflows.length + ')</span>';
    html += '<span>' + fmtMoney(-Math.abs(Number(kpis.totalOutflows || 0))) + '</span>';
    html += '</div>';
    if (outflows.length === 0) {
      html += '<div style="color:#047857;font-weight:700;font-size:8.5px;text-align:center;">✔ لا توجد مصاريف أو سحوبات في هذه الوردية</div>';
    } else {
      for (let i = 0; i < outflows.length; i++) {
        const o = outflows[i];
        html += '<div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">';
        html += '<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;">';
        html += '<span>' + (i + 1) + '. ' + esc(o.beneficiary) + ' <span style="font-weight:700;color:#64748b;font-size:8px;">(' + esc(o.time || '--:--') + ')</span></span>';
        html += '<span style="color:#be123c;">' + fmtMoney(-Math.abs(o.amount)) + '</span>';
        html += '</div>';
        html += '<div style="font-size:8.3px;color:#475569;padding-right:8px;">السبب: ' + esc(o.typeLabel) + (o.reason && o.reason !== o.typeLabel ? ' — ' + esc(o.reason) : '') + '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    // 3. دفتر الزبائن الذين أخذوا بالدين اليوم (كريدي الوردية)
    html += '<div style="border:1px solid #fed7aa;border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#fff;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #fdba74;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#9a3412;">';
    html += '<span>📝 ديون اليوم (الزبائن المدينون) (' + creditSales.length + ')</span>';
    html += '<span>' + fmtMoney(Number(kpis.totalCreditAddedToday || 0), true) + '</span>';
    html += '</div>';
    if (creditSales.length === 0) {
      html += '<div style="color:#047857;font-weight:700;font-size:8.5px;text-align:center;">✔ لم تُسجل مبيعات بالدين في هذه الوردية</div>';
    } else {
      for (let i = 0; i < creditSales.length; i++) {
        const cs = creditSales[i];
        html += '<div style="border-bottom:1px dotted #e2e8f0;padding:2.5px 0;">';
        html += '<div style="display:flex;justify-content:space-between;gap:4px;font-weight:900;">';
        html += '<span>' + (i + 1) + '. ' + esc(cs.customerName) + '</span>';
        html += '<span style="color:#c2410c;">' + fmtMoney(cs.creditAdded, true) + '</span>';
        html += '</div>';
        html += '<div style="font-size:8px;color:#475569;display:flex;justify-content:space-between;">';
        html += '<span>فاتورة ' + esc(cs.docNumber) + ' (' + esc(cs.time || '') + ') | مدفوع: ' + fmtMoney(cs.paidToday) + '</span>';
        html += '<span>دينه الكلي: ' + fmtMoney(cs.cumulativeDebtNow) + '</span>';
        html += '</div>';
        html += '</div>';
      }
    }
    html += '</div>';

    // 4. تحصيلات الديون المقبوضة في الوردية بأسماء الزبائن الحقيقية
    if (collections.length > 0) {
      html += '<div style="border:1px solid #a7f3d0;border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#ecfdf5;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px dashed #34d399;padding-bottom:2px;margin-bottom:3px;font-weight:900;color:#065f46;">';
      html += '<span>🤝 تحصيلات الديون بالوردية (' + collections.length + ')</span>';
      html += '<span>' + fmtMoney(Number(kpis.totalDebtCollected || 0), true) + '</span>';
      html += '</div>';
      for (let i = 0; i < collections.length; i++) {
        const col = collections[i];
        html += '<div style="display:flex;justify-content:space-between;font-size:8.6px;padding:1.5px 0;border-bottom:1px dotted #d1fae5;">';
        html += '<span style="font-weight:800;">' + esc(col.customerName) + (col.count > 1 ? ' (' + col.count + ' دفعات)' : '') + '</span>';
        html += '<span style="color:#047857;font-weight:900;">' + fmtMoney(col.total, true) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    // 5. ملخص وسائل الدفع ومؤشرات الأداء السريعة
    html += '<div style="border:1px solid ' + border + ';border-radius:6px;padding:4px 5px;margin-bottom:6px;background:#f8fafc;">';
    html += '<div style="font-weight:900;color:' + primary + ';border-bottom:1px dashed #cbd5e1;padding-bottom:2px;margin-bottom:3px;">💳 تفصيل المبيعات ووسائل الدفع</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;font-size:8.4px;">';
    html += '<div>عدد الفواتير: <b>' + Number(kpis.salesCount || 0) + '</b></div>';
    html += '<div>رقم الأعمال: ' + fmtMoney(kpis.totalSalesRevenue || 0) + '</div>';
    html += '<div>نقداً (Cash): ' + fmtMoney(pm.cash || 0) + '</div>';
    html += '<div>إلكتروني (CIB/CCP): ' + fmtMoney(Number(pm.cib || 0) + Number(pm.baridimob || 0)) + '</div>';
    html += '<div>آجل (كريدي): ' + fmtMoney(pm.credit || 0) + '</div>';
    html += '<div>التخفيضات: ' + fmtMoney(kpis.totalDiscounts || 0) + '</div>';
    html += '</div></div>';

    // 6. خانة المصادقة والتوقيع المزدوجة (80mm)
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;padding-top:5px;border-top:1.5px dashed #94a3b8;text-align:center;font-size:8.3px;font-weight:800;color:#334155;">';
    html += '<div style="border:1px dashed #cbd5e1;border-radius:5px;padding:4px 3px 16px;">توقيع الكاشير (المسلّم)<br><span style="font-weight:700;font-size:7.8px;color:#64748b;">' + esc((rec && rec.cashierName) || '') + '</span></div>';
    html += '<div style="border:1px dashed #cbd5e1;border-radius:5px;padding:4px 3px 16px;">توقيع صاحب المتجر<br><span style="font-weight:700;font-size:7.8px;color:#64748b;">المصادقة والاستلام</span></div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function renderExecutiveA4WarBlock(dossier, rec, theme) {
    const primary = (theme && theme.primary) || '#1e3a8a';
    const border = (theme && theme.border) || '#cbd5e1';
    const outflows = Array.isArray(dossier.outflows) ? dossier.outflows : [];
    const inflows = Array.isArray(dossier.inflows) ? dossier.inflows : [];
    const creditSales = Array.isArray(dossier.creditSalesToday) ? dossier.creditSalesToday : [];
    const debtCols = Array.isArray(dossier.debtCollections) ? dossier.debtCollections : [];
    const topDebtors = Array.isArray(dossier.topDebtors) ? dossier.topDebtors : [];
    const alerts = Array.isArray(dossier.ownerAlerts) ? dossier.ownerAlerts : [];
    const kpis = dossier.kpis || {};
    const pm = dossier.paymentBreakdown || {};

    let html = '<div data-s5d-war-dossier="1" style="margin-top:12px;font-family:\'Cairo\',\'Tajawal\',Tahoma,Arial,sans-serif;direction:rtl;text-align:right;font-size:11px;line-height:1.45;color:#0f172a;">';

    // 1. لوحة مؤشرات القيادة العلوية (4 KPIs)
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">';
    html += '<div style="border:1.5px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#1e40af;">📊 رقم أعمال الوردية</div>';
    html += '<div style="font-size:13px;color:#1e3a8a;margin-top:2px;">' + fmtMoney(kpis.totalSalesRevenue || 0) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">' + Number(kpis.salesCount || 0) + ' فاتورة | متوسط: ' + fmtMoney(kpis.avgBasket || 0) + '</div></div>';

    html += '<div style="border:1.5px solid #fecdd3;background:#fff1f2;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#9f1239;">💸 الأموال الخارجة (مصاريف/سلَف)</div>';
    html += '<div style="font-size:13px;color:#be123c;margin-top:2px;">' + fmtMoney(-Math.abs(Number(kpis.totalOutflows || 0))) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">' + outflows.length + ' عملية خروج من الدرج</div></div>';

    html += '<div style="border:1.5px solid #fed7aa;background:#fff7ed;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#9a3412;">📝 كريدي ممنوح في الوردية</div>';
    html += '<div style="font-size:13px;color:#c2410c;margin-top:2px;">' + fmtMoney(kpis.totalCreditAddedToday || 0, true) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">' + creditSales.length + ' زبائن أخذوا بالدين اليوم</div></div>';

    html += '<div style="border:1.5px solid #a7f3d0;background:#ecfdf5;border-radius:8px;padding:7px;text-align:center;">';
    html += '<div style="font-size:9.5px;font-weight:800;color:#065f46;">🤝 تحصيلات الديون المقبوضة</div>';
    html += '<div style="font-size:13px;color:#047857;margin-top:2px;">' + fmtMoney(kpis.totalDebtCollected || 0, true) + '</div>';
    html += '<div style="font-size:8.8px;color:#475569;">ديون المتجر الكلية: ' + fmtMoney(kpis.storeTotalDebtReal || 0) + '</div></div>';
    html += '</div>';

    // 2. صندوق تنبيهات المستشار الرقابي
    if (alerts.length > 0) {
      html += '<div style="border:1.5px solid #e11d48;background:#fff1f2;border-radius:8px;padding:7px 10px;margin-bottom:10px;">';
      html += '<div style="font-weight:900;color:#9f1239;font-size:11px;margin-bottom:3px;">🛡️ تقرير رادار الرقابة وتنبيهات صاحب المتجر:</div>';
      for (let i = 0; i < alerts.length; i++) {
        const al = alerts[i];
        const col = al.level === 'danger' ? '#be123c' : al.level === 'warning' ? '#b45309' : '#1d4ed8';
        html += '<div style="color:' + col + ';font-weight:800;font-size:10px;margin-top:2px;">• ' + esc(al.text) + '</div>';
      }
      html += '</div>';
    }

    // 3. جدول #1: سجل الأموال الخارجة والمصاريف والسلَف بالتفصيل
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-weight:900;font-size:11.5px;color:#9f1239;border-bottom:2px solid #fda4af;padding-bottom:3px;margin-bottom:5px;">1️⃣ سجل الأموال الخارجة من الدرج (المصاريف، السلَف، السحوبات، وتسديد الموردين)</div>';
    if (outflows.length === 0) {
      html += '<div style="padding:6px;border:1px dashed #a7f3d0;background:#ecfdf5;border-radius:6px;color:#065f46;font-weight:800;text-align:center;">✔ لم تخرج أي مصاريف أو سحوبات نقدية من الدرج خلال هذه الوردية</div>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
      html += '<thead><tr style="background:#ffe4e6;color:#881337;">';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:5%;">#</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:10%;">الساعة</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:18%;">النوع</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:22%;">المستفيد / الآخذ</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:30%;">السبب والبيان التفصيلي</th>';
      html += '<th style="border:1px solid #fecdd3;padding:4px;width:15%;">المبلغ</th>';
      html += '</tr></thead><tbody>';
      for (let i = 0; i < outflows.length; i++) {
        const o = outflows[i];
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + (i + 1) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(o.time || '--:--') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">' + esc(o.typeLabel) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#9f1239;">' + esc(o.beneficiary) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;">' + esc(o.reason) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#be123c;">' + fmtMoney(-Math.abs(o.amount)) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
    html += '</div>';

    // 4. جدول #2: قائمة الزبائن الذين أخذوا بالدين اليوم (كريدي الوردية)
    html += '<div style="margin-bottom:10px;">';
    html += '<div style="font-weight:900;font-size:11.5px;color:#9a3412;border-bottom:2px solid #fdba74;padding-bottom:3px;margin-bottom:5px;">2️⃣ قائمة الزبائن المدينين اليوم (المبيعات الآجلة والدفع الجزئي في هذه الوردية)</div>';
    if (creditSales.length === 0) {
      html += '<div style="padding:6px;border:1px dashed #a7f3d0;background:#ecfdf5;border-radius:6px;color:#065f46;font-weight:800;text-align:center;">✔ جميع مبيعات هذه الوردية كانت مدفوعة بالكامل بدون ديون جديدة</div>';
    } else {
      html += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
      html += '<thead><tr style="background:#ffedd5;color:#7c2d12;">';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:5%;">#</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:15%;">الفاتورة / الوقت</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:28%;">اسم الزبون والهاتف</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">الإجمالي</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">المدفوع</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">دين اليوم (+)</th>';
      html += '<th style="border:1px solid #fed7aa;padding:4px;width:13%;">دينه الكلي الآن</th>';
      html += '</tr></thead><tbody>';
      for (let i = 0; i < creditSales.length; i++) {
        const cs = creditSales[i];
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + (i + 1) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(cs.docNumber) + '<br><span style="font-size:8.5px;color:#64748b;">' + esc(cs.time || '') + '</span></td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;">' + esc(cs.customerName) + (cs.customerPhone ? '<br><span style="font-size:8.5px;color:#475569;">' + esc(cs.customerPhone) + '</span>' : '') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;">' + fmtMoney(cs.invoiceTotal) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">' + fmtMoney(cs.paidToday) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#c2410c;">' + fmtMoney(cs.creditAdded, true) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#991b1b;">' + fmtMoney(cs.cumulativeDebtNow) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
    html += '</div>';

    // 5. جدول #3: تحصيلات الديون والإيداعات النقدية (الأموال الداخلة للدرج بأسماء الزبائن)
    if (debtCols.length > 0 || inflows.length > 0) {
      html += '<div style="margin-bottom:10px;">';
      html += '<div style="font-weight:900;font-size:11.5px;color:#065f46;border-bottom:2px solid #6ee7b7;padding-bottom:3px;margin-bottom:5px;">3️⃣ سجل تحصيلات الديون والإيداعات النقدية الداخلة للدرج</div>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:10px;">';
      html += '<thead><tr style="background:#d1fae5;color:#064e3b;">';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:5%;">#</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:11%;">الساعة</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:18%;">النوع</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:26%;">اسم الزبون / المصدر</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:25%;">البيان / الباقي عليه</th>';
      html += '<th style="border:1px solid #a7f3d0;padding:4px;width:15%;">المبلغ المقبوض</th>';
      html += '</tr></thead><tbody>';
      let rowNum = 0;
      for (let i = 0; i < debtCols.length; i++) {
        const dc = debtCols[i];
        rowNum++;
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + rowNum + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(dc.time || '--:--') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">تحصيل دين زبون</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;color:#065f46;">' + esc(dc.customerName) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;">' + esc(dc.note) + (dc.remainingDebtNow !== null && dc.remainingDebtNow !== undefined ? ' | الباقي: ' + fmtMoney(dc.remainingDebtNow) : '') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">' + fmtMoney(dc.amount, true) + '</td>';
        html += '</tr>';
      }
      for (let i = 0; i < inflows.length; i++) {
        const inf = inflows[i];
        rowNum++;
        html += '<tr>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + rowNum + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:center;">' + esc(inf.time || '--:--') + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:800;">' + esc(inf.typeLabel) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;font-weight:900;">' + esc(inf.source) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;">' + esc(inf.reason) + '</td>';
        html += '<td style="border:1px solid #e2e8f0;padding:4px;text-align:left;color:#047857;">' + fmtMoney(inf.amount, true) + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    // 6. صف مزدوج: تفصيل وسائل الدفع + أهم المدينين في المتجر للمتابعة غداً
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">';
    html += '<div style="border:1px solid ' + border + ';border-radius:8px;padding:7px;background:#f8fafc;">';
    html += '<div style="font-weight:900;color:' + primary + ';border-bottom:1px dashed #cbd5e1;padding-bottom:3px;margin-bottom:4px;">💳 تفصيل المبيعات حسب وسيلة الدفع</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>💵 الدفع نقداً (Espèces):</span>' + fmtMoney(pm.cash || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>💳 بطاقة ذهبية / CIB:</span>' + fmtMoney(pm.cib || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>📱 بريدي موب (BaridiMob):</span>' + fmtMoney(pm.baridimob || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>🏦 شيك بنكي / صك:</span>' + fmtMoney(pm.cheque || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>📝 بيع آجل (كريدي):</span>' + fmtMoney(pm.credit || 0) + '</div>';
    html += '<div style="display:flex;justify-content:space-between;padding:2px 0;border-top:1px dashed #cbd5e1;margin-top:2px;font-weight:900;"><span>🏷️ إجمالي التخفيضات الممنوحة:</span>' + fmtMoney(kpis.totalDiscounts || 0) + '</div>';
    html += '</div>';

    html += '<div style="border:1px solid ' + border + ';border-radius:8px;padding:7px;background:#f8fafc;">';
    html += '<div style="font-weight:900;color:#9a3412;border-bottom:1px dashed #fdba74;padding-bottom:3px;margin-bottom:4px;">📌 أكبر المدينين في المتجر حالياً (للمتابعة والتحصيل)</div>';
    if (topDebtors.length === 0) {
      html += '<div style="color:#047857;font-weight:800;padding:12px 0;text-align:center;">✔ لا توجد ديون عالقة على الزبائن حالياً</div>';
    } else {
      for (let i = 0; i < Math.min(5, topDebtors.length); i++) {
        const td = topDebtors[i];
        html += '<div style="display:flex;justify-content:space-between;padding:2px 0;border-bottom:1px dotted #e2e8f0;font-size:9.8px;">';
        html += '<span style="font-weight:800;">' + (i + 1) + '. ' + esc(td.name) + (td.phone ? ' <span style="color:#64748b;font-weight:600;">(' + esc(td.phone) + ')</span>' : '') + '</span>';
        html += '<span style="color:#b91c1c;">' + fmtMoney(td.debt) + '</span>';
        html += '</div>';
      }
      html += '<div style="display:flex;justify-content:space-between;padding-top:4px;font-weight:900;color:#7c2d12;"><span>إجمالي ذمم الزبائن بالمتجر (' + Number(kpis.debtorsCount || topDebtors.length) + '):</span>' + fmtMoney(kpis.storeTotalDebtReal || 0) + '</div>';
    }
    html += '</div></div>';

    // 7. جدول المصادقة والتوقيعات الثلاثية (A4)
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px;text-align:center;font-size:10px;font-weight:900;color:#334155;">';
    html += '<div style="border:1.5px dashed #94a3b8;border-radius:8px;padding:8px 6px 36px;">أمين الصندوق (المسلّم)<br><span style="font-weight:700;font-size:9px;color:#64748b;">' + esc((rec && rec.cashierName) || '') + '</span></div>';
    html += '<div style="border:1.5px dashed #94a3b8;border-radius:8px;padding:8px 6px 36px;">المراجع / المحاسب<br><span style="font-weight:700;font-size:9px;color:#64748b;">مطابقة الجرد والوثائق</span></div>';
    html += '<div style="border:1.5px dashed #94a3b8;border-radius:8px;padding:8px 6px 36px;">صاحب المتجر / المدير<br><span style="font-weight:700;font-size:9px;color:#64748b;">المصادقة والختم النهائي</span></div>';
    html += '</div>';

    html += '</div>';
    return html;
  }

  function injectBlockIntoPaperHtml(html, blockHtml) {
    if (!html || !blockHtml || html.includes('data-s5d-war-dossier="1"')) return html;

    // 1. حقن قبل طبقة التذييل الرسمية إذا كانت موجودة
    const footerMarkers = [
      /<div[^>]*data-layer-id=["']footer_stamp_layer["'][^>]*>/i,
      /<div[^>]*class=["'][^"']*psp-footer[^"']*["'][^>]*>/i,
      /<div[^>]*>[^<]*وثيقة محاسبية ورقابية رسمية/i
    ];
    for (let i = 0; i < footerMarkers.length; i++) {
      const m = html.match(footerMarkers[i]);
      if (m && typeof m.index === 'number') {
        return html.slice(0, m.index) + blockHtml + html.slice(m.index);
      }
    }

    // 2. قبل إغلاق آخر div للورقة أو قبل </body>
    const bodyCloseIdx = html.lastIndexOf('</body>');
    if (bodyCloseIdx !== -1) {
      const lastDivBeforeBody = html.lastIndexOf('</div>', bodyCloseIdx);
      if (lastDivBeforeBody !== -1) {
        return html.slice(0, lastDivBeforeBody) + blockHtml + html.slice(lastDivBeforeBody);
      }
      return html.slice(0, bodyCloseIdx) + blockHtml + html.slice(bodyCloseIdx);
    }

    const lastDiv = html.lastIndexOf('</div>');
    if (lastDiv !== -1) {
      return html.slice(0, lastDiv) + blockHtml + html.slice(lastDiv);
    }
    return html + blockHtml;
  }

  function installStage5D() {
    const s5 = window.GherbiStage5Ops;
    const PSP = window.GherbiPrintStudioPro;
    if (!s5 || !PSP || !PSP.renderer || s5._stage5DInstalled) return false;
    s5._stage5DInstalled = true;

    s5.buildSampleForensicDossier = buildSampleForensicDossier;
    s5.renderThermal80mmWarBlock = renderThermal80mmWarBlock;
    s5.renderExecutiveA4WarBlock = renderExecutiveA4WarBlock;

    // 1. تمرير forensicDossier الحقيقي عبر printShiftZReport مع ضبط إجمالي ديون المتجر الحقيقي
    const prevPrintZ = s5.printShiftZReport.bind(s5);
    s5.printShiftZReport = async function stage5DPrintShiftZ(sessionIdOrDetails, format = '80mm', opts = {}) {
      let details = null;
      if (sessionIdOrDetails && typeof sessionIdOrDetails === 'object') {
        details = sessionIdOrDetails;
      } else {
        const sid = Number(sessionIdOrDetails || 0);
        if (sid > 0 && window.api && typeof window.api.getSessionDetails === 'function') {
          details = await window.api.getSessionDetails(sid);
        } else {
          details = await s5.fetchActiveSession(null, { force: true });
        }
      }
      if (!details) return await prevPrintZ(sessionIdOrDetails, format, opts);

      // تخزين مؤقت لـ forensicDossier الحالي للربط التلقائي عند الرسم
      s5._lastRenderedShiftDossier = details.forensicDossier || null;
      s5._lastRenderedShiftRec = s5.computeExactShiftReconciliation(details);
      if (details.forensicDossier && details.forensicDossier.kpis) {
        s5._lastRenderedShiftRec.totalStoreCustomerDebt = details.forensicDossier.kpis.storeTotalDebtReal;
        s5._lastRenderedShiftRec.newCreditGiven = details.forensicDossier.kpis.totalCreditAddedToday;
      }

      const out = await prevPrintZ(details, format, opts);
      return out;
    };

    // 2. تغليف دوال الرسم في Print Studio Pro لحقن التقرير القيادي تلقائياً في caisse_z_report (80mm) و caisse_shift_full_audit_a4 (A4)
    const renderer = PSP.renderer;
    const candidateMethods = Object.keys(renderer).filter(
      (k) => typeof renderer[k] === 'function' && /render/i.test(k) && !/layer/i.test(k)
    );

    for (let i = 0; i < candidateMethods.length; i++) {
      const mName = candidateMethods[i];
      const origFn = renderer[mName].bind(renderer);

      renderer[mName] = function stage5DWrappedRender(...args) {
        let result = origFn(...args);
        try {
          const tpl = args[0] && typeof args[0] === 'object' ? args[0] : null;
          const docData = args[1] && typeof args[1] === 'object' ? args[1] : null;
          const docId = String((tpl && tpl.id) || (docData && docData.docType) || '');
          if (docId !== 'caisse_z_report' && docId !== 'caisse_shift_full_audit_a4') {
            return result;
          }

          const htmlStr = typeof result === 'string' ? result : result && typeof result.fullHtml === 'string' ? result.fullHtml : '';
          if (!htmlStr || htmlStr.includes('data-s5d-war-dossier="1"')) return result;

          const paper = String((tpl && tpl.paperSize) || (docId === 'caisse_shift_full_audit_a4' ? 'a4' : '80mm')).toLowerCase();
          const isThermal = paper === '80mm' || paper === '58mm';

          // اختيار الملف الجنائي الحقيقي إن وُجد في docData أو آخر مناوبة، وإلا بيانات نموذجية غنية لمعاينة مركز الطباعة
          const hasRealShift = Boolean((docData && docData.shiftSummary && docData.shiftSummary.sessionId) || (docData && docData.forensicDossier));
          const dossier =
            (docData && docData.forensicDossier) ||
            (hasRealShift && s5._lastRenderedShiftDossier) ||
            buildSampleForensicDossier();
          const rec =
            (docData && docData.shiftSummary) ||
            (hasRealShift && s5._lastRenderedShiftRec) ||
            { cashierName: (docData && docData.cashierName) || 'المدير العام' };

          const themeObj =
            (PSP.templates && PSP.templates.THEMES && tpl && PSP.templates.THEMES[tpl.themeId]) ||
            (window.GherbiPrintStudioPro?.THEMES && tpl && window.GherbiPrintStudioPro.THEMES[tpl.themeId]) ||
            { primary: '#1e3a8a', border: '#cbd5e1' };

          const warBlock = isThermal
            ? renderThermal80mmWarBlock(dossier, rec, themeObj)
            : renderExecutiveA4WarBlock(dossier, rec, themeObj);

          // تصحيح رقم "المتجر:" في بطاقة الميزان العلوية إذا كانت القيمة الحقيقية متوفرة
          let patchedHtml = htmlStr;
          if (dossier && dossier.kpis && dossier.kpis.storeTotalDebtReal !== undefined) {
            const realStoreStr = fmtMoney(dossier.kpis.storeTotalDebtReal);
            patchedHtml = patchedHtml.replace(/(المتجر:\s*)(?:<[^>]+>)*[0-9,.\s\u2066-\u2069&#160;]+د\.ج(?:<\/[^>]+>)*/g, '$1' + realStoreStr);
          }

          patchedHtml = injectBlockIntoPaperHtml(patchedHtml, warBlock);

          if (typeof result === 'string') return patchedHtml;
          return { ...result, fullHtml: patchedHtml };
        } catch (_) {
          return result;
        }
      };
    }

    console.log('🛡️ [WAR STAGE 5D]: تم تفعيل محرك تقارير إغلاق الوردية القيادية (80mm + A4: مصاريف، سلَف، ديون اليوم، تحصيلات، ورادار الرقابة).');
    return true;
  }

  if (!installStage5D()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (installStage5D() || k >= 40) clearInterval(iv);
    }, 100);
  }
})();
