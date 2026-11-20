/**
 * perf-core/pos-debt-stage3.js
 * الشطر 3: تسريع شاشة المبيعات (#view-pos) وضبط طباعة الكاشير والديون (Échap, F1, Alt+D, Alt+V, Alt+H, F8)
 */
'use strict';
(function buildPosDebtStage3Module() {
  (function initGherbiPosAndDebtStage3() {
    'use strict';

    if (window.GherbiPosStage3 && window.GherbiPosStage3._installed) {
      return;
    }

    const PosStage3 = {
      _installed: true,
      version: '3.0.0-war-stage3',

      // فهرس الباركود السريع O(1)
      _barcodeIndex: new Map(),
      _barcodeSourceRef: null,
      _barcodeSourceLen: -1,

      // مؤقتات دمج التحديثات
      _searchTimer: null,
      _custDisplayTimer: null,
      _lastGridSig: '',

      metrics: {
        barcodeIndexHits: 0,
        barcodeIndexRebuilds: 0,
        searchDebouncedCalls: 0,
        cartFramesCoalesced: 0,
        bannerFramesCoalesced: 0,
        freshCustomerSyncs: 0,
        routedPosPrints: 0
      },

      // ======================================================================
      // أ) فهرسة الباركودات O(1) (أساسي + فرعي + متغيرات + PLU)
      // ======================================================================
      rebuildBarcodeIndex(productsList) {
        const list = Array.isArray(productsList)
          ? productsList
          : (window.AppState && Array.isArray(window.AppState.products) ? window.AppState.products : []);
        this._barcodeIndex.clear();
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          if (!p) continue;
          if (p.barcode) {
            const k = String(p.barcode).trim();
            if (k) this._barcodeIndex.set(k, { product: p, variant: null, priceLabel: null });
          }
          if (p.plu_code) {
            const plu = String(p.plu_code).trim();
            if (plu && !this._barcodeIndex.has(plu)) {
              this._barcodeIndex.set(plu, { product: p, variant: null, priceLabel: null });
            }
          }
          const extras = Array.isArray(p.extra_barcodes) ? p.extra_barcodes : Array.isArray(p.barcodes) ? p.barcodes : [];
          for (let j = 0; j < extras.length; j++) {
            const eb = extras[j];
            const code = typeof eb === 'string' ? eb.trim() : String(eb && eb.barcode ? eb.barcode : '').trim();
            if (code) {
              this._barcodeIndex.set(code, {
                product: p,
                variant: null,
                priceLabel: typeof eb === 'object' && eb ? (eb.price_label || null) : null
              });
            }
          }
          const variants = Array.isArray(p.variants) ? p.variants : [];
          for (let v = 0; v < variants.length; v++) {
            const vr = variants[v];
            if (vr && vr.barcode) {
              const vc = String(vr.barcode).trim();
              if (vc) this._barcodeIndex.set(vc, { product: p, variant: vr, priceLabel: null });
            }
          }
        }
        this._barcodeSourceRef = list;
        this._barcodeSourceLen = list.length;
        this.metrics.barcodeIndexRebuilds++;
        return this._barcodeIndex.size;
      },

      lookupBarcodeFast(rawCode, productsList) {
        const code = String(rawCode || '').trim();
        if (!code) return null;
        const list = Array.isArray(productsList)
          ? productsList
          : (window.AppState && Array.isArray(window.AppState.products) ? window.AppState.products : []);
        if (list !== this._barcodeSourceRef || list.length !== this._barcodeSourceLen || this._barcodeIndex.size === 0) {
          this.rebuildBarcodeIndex(list);
        }
        const hit = this._barcodeIndex.get(code) || null;
        if (hit) this.metrics.barcodeIndexHits++;
        return hit;
      },

      // ======================================================================
      // ب) مزامنة حية لبيانات ورصيد الزبون من SQLite قبل أي طباعة
      // ======================================================================
      async fetchFreshCustomerForPrint(customerId) {
        const cid = Number(customerId || 0);
        if (cid <= 0) return null;

        this.metrics.freshCustomerSyncs++;
        if (window.GherbiPerfCore && typeof window.GherbiPerfCore.invalidateCache === 'function') {
          window.GherbiPerfCore.invalidateCache('pre_print_customer_sync');
        }

        let custObj = null;
        let creditSummary = null;

        try {
          const tasks = [];
          if (window.api && typeof window.api.getCustomerCreditSummary === 'function') {
            tasks.push(window.api.getCustomerCreditSummary(cid).then((r) => { creditSummary = r; }).catch(() => {}));
          }
          if (window.api && typeof window.api.getCustomers === 'function') {
            tasks.push(window.api.getCustomers({}).then((rows) => {
              if (Array.isArray(rows)) {
                custObj = rows.find((c) => Number(c.id) === cid) || null;
                if (window.AppState) window.AppState.customers = rows;
                if (window.GherbiDebtV68 && window.GherbiDebtV68.customersById) {
                  window.GherbiDebtV68.customers = rows;
                  window.GherbiDebtV68.customersById.clear();
                  rows.forEach((c) => window.GherbiDebtV68.customersById.set(Number(c.id), c));
                }
              }
            }).catch(() => {}));
          }
          await Promise.all(tasks);
        } catch (_) {}

        if (!custObj && !creditSummary) return null;

        const currentDebt = Math.max(
          0,
          Number(
            creditSummary && creditSummary.current_debt !== undefined
              ? creditSummary.current_debt
              : (custObj && custObj.total_debt) || 0
          )
        );

        const fid = (custObj && custObj.loyalty_card_code) || ('FID-' + String(cid).padStart(5, '0'));
        return {
          id: cid,
          name: (custObj && custObj.name) || (creditSummary && creditSummary.name) || `زبون #${cid}`,
          fid,
          phone: (custObj && custObj.phone) || '',
          address: (custObj && custObj.address) || '',
          rc: (custObj && custObj.rc) || '',
          nif: (custObj && custObj.nif) || '',
          loyaltyPoints: Math.max(0, Math.floor(Number((custObj && custObj.loyalty_points) || 0))),
          currentDebt: Number(currentDebt.toFixed(2)),
          totalSales: Number((custObj && custObj.total_sales) || 0),
          totalPaid: Number((custObj && custObj.total_paid) || 0)
        };
      },

      // ======================================================================
      // ج) موجهات الطباعة الدقيقة لشاشة المبيعات ومنظومة الديون
      // ======================================================================

      // 1. طباعة تذكرة الكاشير أو الفاتورة (Échap / F1) مع حارس الزبون العابر
      async printPosSaleTicket(saleOrId, format = '80mm', opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        const docType = format === 'a4' ? 'invoice_a4' : format === 'a5' ? 'invoice_a5' : 'receipt_thermal';
        let data = typeof saleOrId === 'object' && saleOrId
          ? { ...saleOrId }
          : await PSP.router.fetchDocDataByEntityId(docType, saleOrId);

        const cid = Number(data.customerId || data.customer_id || 0);
        if (cid > 0) {
          const fresh = await this.fetchFreshCustomerForPrint(cid);
          if (fresh) {
            data.customerId = fresh.id;
            data.isWalkinCustomer = false;
            data.partyName = `${fresh.name} (${fresh.fid})`;
            data.partyPhone = fresh.phone || data.partyPhone || '';
            data.partyAddress = fresh.address || data.partyAddress || '';
            data.loyaltyTotalBalance = fresh.loyaltyPoints;
            data.customerCurrentTotalDebt = fresh.currentDebt;
          }
        } else {
          data.customerId = null;
          data.isWalkinCustomer = true;
          data.partyName = 'زبون عابر (Comptoir)';
          data.loyaltyTotalBalance = 0;
          data.loyaltyPointsEarned = 0;
          data.previousBalance = 0;
          data.customerCurrentTotalDebt = 0;
        }

        this.metrics.routedPosPrints++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc(docType, data, opts.asPdf ? 'pdf' : 'print', { paperSize: format });
        }
        return await PSP.router.printDocumentByType(docType, data, { ...opts, paperSize: format });
      },

      // 2. طباعة تذكرة الدين الجديد / الدفع الجزئي (Alt+D) بالتبديل الذكي بين #10 و #11
      async printAltDCreditTicket(rawSaleData, opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        const data = { ...(rawSaleData || {}) };
        const total = Math.max(0, Number(data.total ?? 0));
        const paid = Math.max(0, Number(data.paidAmount ?? data.paid_amount ?? 0));
        const addedToday = Math.max(0, Number((total - paid).toFixed(2)));
        const cid = Number(data.customerId || data.customer_id || 0);

        const fresh = cid > 0 ? await this.fetchFreshCustomerForPrint(cid) : null;
        const explicitPrev =
          data.previousBalance !== undefined && data.previousBalance !== null && data.previousBalance !== ''
            ? Math.max(0, Number(data.previousBalance))
            : null;

        let prevDebt = 0;
        let newTotalDebt = addedToday;

        if (fresh) {
          data.customerId = fresh.id;
          data.isWalkinCustomer = false;
          data.partyTitle = data.partyTitle || 'الزبون الوفي:';
          data.partyName = `${fresh.name} (${fresh.fid})`;
          data.partyPhone = fresh.phone || data.partyPhone || '';
          data.partyAddress = fresh.address || data.partyAddress || '';
          data.loyaltyTotalBalance = fresh.loyaltyPoints;

          if (explicitPrev !== null) {
            prevDebt = explicitPrev;
          } else {
            // إذا كان SQLite قد حفظ فاتورة اليوم بالفعل فالدين السابق = fresh.currentDebt - addedToday
            prevDebt = fresh.currentDebt >= addedToday
              ? Math.max(0, Number((fresh.currentDebt - addedToday).toFixed(2)))
              : fresh.currentDebt;
          }
          newTotalDebt = Math.max(Number((prevDebt + addedToday).toFixed(2)), fresh.currentDebt);
        } else {
          prevDebt = explicitPrev !== null ? explicitPrev : 0;
          newTotalDebt = Number((prevDebt + addedToday).toFixed(2));
        }

        data.total = total;
        data.paidAmount = paid;
        data.remainingDebt = addedToday;
        data.previousBalance = prevDebt;
        data.customerCurrentTotalDebt = newTotalDebt;

        // التوجيه الذكي: دين كلي (#10) مقابل دفع جزئي (#11)
        const docType = paid <= 0.009 ? 'debt_confirm_ticket_80mm' : 'pos_partial_credit_80mm';
        this.metrics.routedPosPrints++;

        if (opts.renderOnly) {
          return PSP.router.renderDoc(docType, data, opts.asPdf ? 'pdf' : 'print', { paperSize: '80mm' });
        }
        return await PSP.router.printDocumentByType(docType, data, { ...opts, paperSize: '80mm' });
      },

      // 3. طباعة وصل قبض وتسديد دين زبون (Alt+V — #12) بدقة 80mm وبدون تكرار
      async printAltVSettlementReceipt(rawPayData, opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        const data = { ...(rawPayData || {}), _docKind: 'settlement' };
        const paidNow = Math.max(0, Number(data.paidAmount ?? data.paid_amount ?? data.amount ?? data.total ?? 0));
        const cid = Number(data.customerId || data.customer_id || 0);
        const fresh = cid > 0 ? await this.fetchFreshCustomerForPrint(cid) : null;

        let debtBefore =
          data.previousBalance !== undefined && data.previousBalance !== null && data.previousBalance !== ''
            ? Math.max(0, Number(data.previousBalance))
            : null;
        let debtAfter =
          data.customerCurrentTotalDebt !== undefined && data.customerCurrentTotalDebt !== null
            ? Math.max(0, Number(data.customerCurrentTotalDebt))
            : null;

        if (fresh) {
          data.customerId = fresh.id;
          data.isWalkinCustomer = false;
          data.partyTitle = 'استلمنا من الزبون الوفي:';
          data.partyName = `${fresh.name} (${fresh.fid})`;
          data.partyPhone = fresh.phone || data.partyPhone || '';
          data.loyaltyTotalBalance = fresh.loyaltyPoints;
          if (debtAfter === null) debtAfter = fresh.currentDebt;
          if (debtBefore === null) debtBefore = Number((debtAfter + paidNow).toFixed(2));
        } else {
          if (debtBefore === null) debtBefore = paidNow;
          if (debtAfter === null) debtAfter = Math.max(0, Number((debtBefore - paidNow).toFixed(2)));
        }

        data.total = paidNow;
        data.paidAmount = paidNow;
        data.receivedAmount = paidNow;
        data.previousBalance = Number(debtBefore.toFixed(2));
        data.customerCurrentTotalDebt = Number(debtAfter.toFixed(2));
        data.remainingDebt = data.customerCurrentTotalDebt;

        this.metrics.routedPosPrints++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc('payment_receipt', data, opts.asPdf ? 'pdf' : 'print', { paperSize: '80mm' });
        }
        return await PSP.router.printDocumentByType('payment_receipt', data, { ...opts, paperSize: '80mm' });
      },

      // 4. طباعة هيستوريك وكرني الزبون (Alt+H — #13 / #14 / #15)
      async printAltHDebtHistory(customerId, mode = 'carnet_80mm', opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        await this.fetchFreshCustomerForPrint(customerId);
        const stmtData = await PSP.router.buildCustomerDebtStatementData(customerId);
        if (!stmtData) return { ok: false, error: 'customer_not_found' };

        const docType =
          mode === 'ledger_a4' || mode === 'a4'
            ? 'customer_ledger_a4'
            : mode === 'items_history_a4'
            ? 'customer_debt_history_a4'
            : 'customer_carnet_80mm';
        const paperSize = docType === 'customer_carnet_80mm' ? '80mm' : 'a4';

        this.metrics.routedPosPrints++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc(docType, stmtData, opts.asPdf ? 'pdf' : 'print', { paperSize });
        }
        if (opts.preview) {
          PSP.router.openQuickPreviewModal(docType, stmtData, { paperSize });
          return { ok: true, preview: true };
        }
        return await PSP.router.printDocumentByType(docType, stmtData, { ...opts, paperSize });
      },

      // 5. طباعة السجل العام لجميع الزبائن المدينين بالمتجر (#16 — A4)
      async printGlobalDebtorsRegisterA4(opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        if (window.GherbiPerfCore) window.GherbiPerfCore.invalidateCache('global_debtors_register');
        const allCustomers = window.api && typeof window.api.getCustomers === 'function'
          ? await window.api.getCustomers({})
          : (window.AppState && Array.isArray(window.AppState.customers) ? window.AppState.customers : []);

        const debtors = (Array.isArray(allCustomers) ? allCustomers : [])
          .filter((c) => Number(c.total_debt || 0) > 0.009)
          .sort((a, b) => Number(b.total_debt || 0) - Number(a.total_debt || 0));

        const totalStoreDebt = Number(debtors.reduce((s, c) => s + Number(c.total_debt || 0), 0).toFixed(2));
        const items = debtors.map((c) => {
          const fid = c.loyalty_card_code || ('FID-' + String(c.id).padStart(5, '0'));
          const debt = Number(c.total_debt || 0);
          const pts = Math.max(0, Math.floor(Number(c.loyalty_points || 0)));
          return {
            barcode: fid,
            name: `${c.name}${c.phone ? ` (${c.phone})` : ''}`,
            unit: `${pts} نقطة`,
            qty: 1,
            price: debt,
            subtotal: debt
          };
        });

        const docData = {
          docNumber: `REG-DEBTS-${new Date().toISOString().slice(0, 10)}`,
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          customerId: 1,
          isWalkinCustomer: false,
          partyTitle: 'إدارة المتجر والخزينة:',
          partyName: `السجل العام للمدينين (${debtors.length} زبوناً مديناً)`,
          paymentMethod: `إجمالي الديون المستحقة لدى الزبائن: ${totalStoreDebt.toFixed(2)} د.ج`,
          items,
          subtotal: totalStoreDebt,
          discount: 0,
          total: totalStoreDebt,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: totalStoreDebt,
          customerCurrentTotalDebt: totalStoreDebt
        };

        this.metrics.routedPosPrints++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc('global_debtors_register_a4', docData, opts.asPdf ? 'pdf' : 'print', { paperSize: 'a4' });
        }
        if (opts.preview) {
          PSP.router.openQuickPreviewModal('global_debtors_register_a4', docData, { paperSize: 'a4' });
          return { ok: true, preview: true };
        }
        return await PSP.router.printDocumentByType('global_debtors_register_a4', docData, { ...opts, paperSize: 'a4' });
      },

      // 6. طباعة بطاقة الزبون الوفي الشاملة (F8 — #17 80mm)
      async printF8VipCard(customerId, opts = {}) {
        const PSP = window.GherbiPrintStudioPro;
        if (!PSP || !PSP.router) return { ok: false, error: 'psp_not_ready' };

        await this.fetchFreshCustomerForPrint(customerId);
        const stmtData = await PSP.router.buildCustomerDebtStatementData(customerId);
        if (!stmtData) return { ok: false, error: 'customer_not_found' };

        this.metrics.routedPosPrints++;
        if (opts.renderOnly) {
          return PSP.router.renderDoc('f8_vip_loyalty_debt_card_80mm', stmtData, opts.asPdf ? 'pdf' : 'print', { paperSize: '80mm' });
        }
        if (opts.preview) {
          PSP.router.openQuickPreviewModal('f8_vip_loyalty_debt_card_80mm', stmtData, { paperSize: '80mm' });
          return { ok: true, preview: true };
        }
        return await PSP.router.printDocumentByType('f8_vip_loyalty_debt_card_80mm', stmtData, { ...opts, paperSize: '80mm' });
      },

      // ======================================================================
      // د) ربط التحسينات بالواجهة الحية لشاشة المبيعات (#view-pos) ومنظومة الديون
      // ======================================================================
      installPosPerformanceHooks() {
        const app = window.App;
        const perf = window.GherbiPerfCore;

        // 1. Debounce ذكي لمربع البحث #globalPosSearch (فوري عند التفريغ، 110ms أثناء الكتابة السريعة)
        if (app && typeof app.onPosSearchInput === 'function' && !app._stage3SearchDebounced) {
          app._stage3SearchDebounced = true;
          const origSearch = app.onPosSearchInput.bind(app);
          const self = this;

          app.onPosSearchInput = function debouncedPosSearch(val) {
            const str = String(val ?? '');
            clearTimeout(self._searchTimer);
            if (!str.trim()) {
              return origSearch(str);
            }
            self.metrics.searchDebouncedCalls++;
            self._searchTimer = setTimeout(() => {
              origSearch(str);
            }, 110);
          };
        }

        // 2. دمج تحديثات السلة في إطار رسومي واحد (rAF) لتفادي إعادة الرسم المتكرر أثناء المسح السريع
        if (app && typeof app.renderCart === 'function' && !app._stage3CartCoalesced) {
          app._stage3CartCoalesced = true;
          const origRenderCart = app.renderCart.bind(app);
          const self = this;

          app.renderCart = function coalescedRenderCart(...args) {
            if (!perf || typeof perf.rafBatch !== 'function') {
              return origRenderCart(...args);
            }
            self.metrics.cartFramesCoalesced++;
            perf.rafBatch('pos_cart_render', () => {
              origRenderCart(...args);
            });
          };
        }

        // 3. تقليل استدعاءات شاشة عرض الزبون الثانية أثناء المسح المتتالي
        if (app && typeof app.pushCustomerDisplayState === 'function' && !app._stage3CustDisplayThrottled) {
          app._stage3CustDisplayThrottled = true;
          const origPush = app.pushCustomerDisplayState.bind(app);
          const self = this;
          app.pushCustomerDisplayState = function throttledCustomerDisplay(...args) {
            clearTimeout(self._custDisplayTimer);
            self._custDisplayTimer = setTimeout(() => {
              origPush(...args);
            }, 60);
          };
        }

        // 4. دمج تحديث شريط الديون الحي في السلة وتقييده بصفحة #view-pos فقط
        const debtEng = window.GherbiDebtV68;
        if (debtEng && !debtEng._stage3Hooked) {
          debtEng._stage3Hooked = true;
          const self = this;

          if (typeof debtEng.refreshLivePosDebtBannerAndButtons === 'function') {
            const origBanner = debtEng.refreshLivePosDebtBannerAndButtons.bind(debtEng);
            debtEng.refreshLivePosDebtBannerAndButtons = function scopedPosDebtBanner() {
              if (perf && perf.getActiveView() !== 'pos') return;
              self.metrics.bannerFramesCoalesced++;
              if (perf && typeof perf.rafBatch === 'function') {
                perf.rafBatch('pos_debt_banner', () => origBanner());
              } else {
                origBanner();
              }
            };
          }

          // ربط طباعة كرني/كشف الديون والسجل العام للمدينين وبطاقة F8
          debtEng.printCustomerStatementNow = (cid, fmt = '80mm', direct = false) =>
            self.printAltHDebtHistory(cid, fmt === 'a4' ? 'ledger_a4' : 'carnet_80mm', { preview: !direct });
          debtEng.printGlobalDebtorsRegister = (direct = false) =>
            self.printGlobalDebtorsRegisterA4({ preview: !direct });
          debtEng.printF8VipCard = (cid, direct = false) =>
            self.printF8VipCard(cid, { preview: !direct });
        }

        // 5. حارس تصفير الزبون العابر على #posCustomerSelect
        const custSel = typeof document !== 'undefined' ? document.getElementById('posCustomerSelect') : null;
        if (custSel && !custSel._stage3WalkinGuardBound) {
          custSel._stage3WalkinGuardBound = true;
          custSel.addEventListener('change', () => {
            if (!custSel.value || Number(custSel.value) <= 0) {
              window.__gherbiActivePosCustomerId = 0;
            } else {
              window.__gherbiActivePosCustomerId = Number(custSel.value);
            }
          });
        }

        // 5ب. ربط App.handleBarcodeScan بفهرس الباركود السريع O(1) لرفع سرعة المسح في الكاشير
        if (app && typeof app.handleBarcodeScan === 'function' && !app._stage3BarcodeHooked) {
          app._stage3BarcodeHooked = true;
          const origScan = app.handleBarcodeScan.bind(app);
          const selfScan = this;
          app.handleBarcodeScan = function fastIndexedBarcodeScan(rawCode, ...rest) {
            const code = String(rawCode || '').trim();
            if (code) {
              const fastHit = selfScan.lookupBarcodeFast(code);
              if (fastHit && fastHit.product && !fastHit.variant && !fastHit.priceLabel && typeof app.addToCart === 'function' && !fastHit.product.has_variants) {
                // إذا لم يكن باركود ميزان يبدأ بـ 20، نضيفه لحظياً ونفرغ حقل الباركود
                if (!code.startsWith('20') || code.length !== 13) {
                  try {
                    const bcInp = document.getElementById('barcodeInput');
                    if (bcInp) bcInp.value = '';
                    return app.addToCart(fastHit.product.id);
                  } catch (_) {}
                }
              }
            }
            return origScan(rawCode, ...rest);
          };
        }

        // 6. إعادة بناء فهرس الباركود تلقائياً عند العودة إلى شاشة المبيعات
        if (perf && typeof perf.onViewEnter === 'function' && !this._viewEnterBound) {
          this._viewEnterBound = true;
          perf.onViewEnter('pos', () => {
            this.rebuildBarcodeIndex();
          });
        }
      },

      getDiagnostics() {
        return {
          version: this.version,
          indexedBarcodesCount: this._barcodeIndex.size,
          metrics: { ...this.metrics }
        };
      },

      boot() {
        this.installPosPerformanceHooks();
        this.rebuildBarcodeIndex();

        let tries = 0;
        const t = setInterval(() => {
          tries++;
          this.installPosPerformanceHooks();
          if (
            tries >= 40 ||
            (window.App && window.App._stage3SearchDebounced && (!window.GherbiDebtV68 || window.GherbiDebtV68._stage3Hooked))
          ) {
            clearInterval(t);
          }
        }, 120);

        console.log('⚡ [Gherbi War Stage 3 — POS & Debt Turbo]: تسريع الكاشير وضبط طباعة الديون (Alt+D/V/H/F8) نشط 100%.');
      }
    };

    window.GherbiPosStage3 = PosStage3;
    PosStage3.boot();
  })();
})();
