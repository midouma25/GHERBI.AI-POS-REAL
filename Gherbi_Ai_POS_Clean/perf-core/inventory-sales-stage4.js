/**
 * perf-core/inventory-sales-stage4.js
 * الشطر الرابع: محرك التوربو للمخزون والمبيعات والمشتريات والزبائن والموردين والشكلية والطلبيات
 */
'use strict';
(function buildStage4Module() {
  (function initWarStage4InventorySalesTurbo() {
    'use strict';

    if (window.GherbiStage4Turbo && window.GherbiStage4Turbo._installed) {
      return;
    }

    const MANAGED_VIEWS = [
      'inventory',
      'sales',
      'purchases',
      'customers',
      'suppliers',
      'proformas',
      'orders'
    ];

    const ROW_WINDOW_INITIAL = 80;
    const ROW_WINDOW_STEP = 100;
    const SEARCH_DEBOUNCE_MS = 130;

    // 1. محرك Single-Flight لمنع تكرار طلبات IPC المتداخلة على نفس القناة
    const inFlightMap = new Map();

    // 2. كاش خفيف زمنياً (مع إبطال فوري عند أي كتابة في قاعدة البيانات)
    const entityCache = new Map();
    const CACHE_TTL_MS = 4500;

    const Stage4 = {
      _installed: true,
      version: '4.0.0-clean-post-80mm',
      revision: 1,
      maps: {
        productsById: new Map(),
        customersById: new Map(),
        suppliersById: new Map(),
        salesById: new Map(),
        purchasesById: new Map()
      },
      metrics: {
        ipcCallsDeduplicated: 0,
        cacheHits: 0,
        indexRebuilds: 0,
        windowedTables: 0,
        debouncedSearches: 0,
        invalidations: 0
      },

      // استدعاء IPC آمن يحترم contextBridge ولا يعدّل window.api المجمّد
      async singleFlightFetch(key, fetcherFn, opts = {}) {
        const force = Boolean(opts.force);
        const ttl = Number(opts.ttlMs ?? CACHE_TTL_MS);
        const now = Date.now();

        if (!force && ttl > 0) {
          const cached = entityCache.get(key);
          if (cached && cached.rev === this.revision && now - cached.ts < ttl) {
            this.metrics.cacheHits++;
            return cached.data;
          }
        }

        if (inFlightMap.has(key)) {
          this.metrics.ipcCallsDeduplicated++;
          return await inFlightMap.get(key);
        }

        const revAtStart = this.revision;
        const promise = Promise.resolve()
          .then(() => fetcherFn())
          .then((res) => {
            if (revAtStart === this.revision && res !== undefined) {
              entityCache.set(key, { ts: Date.now(), rev: this.revision, data: res });
            }
            return res;
          })
          .finally(() => {
            inFlightMap.delete(key);
          });

        inFlightMap.set(key, promise);
        return await promise;
      },

      invalidate(domain = 'all') {
        this.revision++;
        this.metrics.invalidations++;
        if (domain === 'all') {
          entityCache.clear();
        } else {
          for (const k of Array.from(entityCache.keys())) {
            if (k.startsWith(domain)) entityCache.delete(k);
          }
        }
        if (window.GherbiPerfCore && typeof window.GherbiPerfCore.invalidateAll === 'function') {
          try { window.GherbiPerfCore.invalidateAll(); } catch (_) {}
        }
      },

      // إعادة بناء فهارس O(1) بسرعة فائقة
      rebuildEntityMaps(source = {}) {
        const st = window.AppState || {};
        const prods = Array.isArray(source.products) ? source.products : st.products;
        const custs = Array.isArray(source.customers) ? source.customers : st.customers;
        const sups = Array.isArray(source.suppliers) ? source.suppliers : st.suppliers;
        const sales = Array.isArray(source.sales) ? source.sales : st.sales;
        const purch = Array.isArray(source.purchases) ? source.purchases : st.purchases;

        if (Array.isArray(prods)) {
          this.maps.productsById.clear();
          for (let i = 0; i < prods.length; i++) {
            const p = prods[i];
            if (p && p.id != null) this.maps.productsById.set(Number(p.id), p);
          }
        }
        if (Array.isArray(custs)) {
          this.maps.customersById.clear();
          for (let i = 0; i < custs.length; i++) {
            const c = custs[i];
            if (c && c.id != null) this.maps.customersById.set(Number(c.id), c);
          }
        }
        if (Array.isArray(sups)) {
          this.maps.suppliersById.clear();
          for (let i = 0; i < sups.length; i++) {
            const s = sups[i];
            if (s && s.id != null) this.maps.suppliersById.set(Number(s.id), s);
          }
        }
        if (Array.isArray(sales)) {
          this.maps.salesById.clear();
          for (let i = 0; i < sales.length; i++) {
            const s = sales[i];
            if (s && s.id != null) this.maps.salesById.set(Number(s.id), s);
          }
        }
        if (Array.isArray(purch)) {
          this.maps.purchasesById.clear();
          for (let i = 0; i < purch.length; i++) {
            const p = purch[i];
            if (p && p.id != null) this.maps.purchasesById.set(Number(p.id), p);
          }
        }

        this.metrics.indexRebuilds++;
        return {
          products: this.maps.productsById.size,
          customers: this.maps.customersById.size,
          suppliers: this.maps.suppliersById.size,
          sales: this.maps.salesById.size,
          purchases: this.maps.purchasesById.size
        };
      },

      getProductById(id) { return this.maps.productsById.get(Number(id)) || null; },
      getCustomerById(id) { return this.maps.customersById.get(Number(id)) || null; },
      getSupplierById(id) { return this.maps.suppliersById.get(Number(id)) || null; },
      getSaleById(id) { return this.maps.salesById.get(Number(id)) || null; },
      getPurchaseById(id) { return this.maps.purchasesById.get(Number(id)) || null; },

      // قراءة محسّنة عبر Single-Flight للشاشات الإدارية
      async fetchProducts(filters = {}, opts = {}) {
        const key = 'products:' + JSON.stringify(filters || {});
        const rows = await this.singleFlightFetch(key, () => {
          if (window.api && typeof window.api.getProducts === 'function') {
            return window.api.getProducts(filters);
          }
          return [];
        }, opts);
        if (Array.isArray(rows) && (!filters || Object.keys(filters).length === 0)) {
          if (window.AppState) window.AppState.products = rows;
          this.rebuildEntityMaps({ products: rows });
        }
        return rows;
      },

      async fetchSales(filters = {}, opts = {}) {
        const key = 'sales:' + JSON.stringify(filters || {});
        const rows = await this.singleFlightFetch(key, () => {
          if (window.api && typeof window.api.getSales === 'function') {
            return window.api.getSales(filters);
          }
          return [];
        }, opts);
        if (Array.isArray(rows)) {
          if (window.AppState) window.AppState.sales = rows;
          this.rebuildEntityMaps({ sales: rows });
        }
        return rows;
      },

      async fetchCustomers(filters = {}, opts = {}) {
        const key = 'customers:' + JSON.stringify(filters || {});
        const rows = await this.singleFlightFetch(key, () => {
          if (window.api && typeof window.api.getCustomers === 'function') {
            return window.api.getCustomers(filters);
          }
          return [];
        }, opts);
        if (Array.isArray(rows)) {
          if (window.AppState) window.AppState.customers = rows;
          this.rebuildEntityMaps({ customers: rows });
        }
        return rows;
      },

      async fetchSuppliers(opts = {}) {
        const rows = await this.singleFlightFetch('suppliers:all', () => {
          if (window.api && typeof window.api.getSuppliers === 'function') {
            return window.api.getSuppliers();
          }
          return [];
        }, opts);
        if (Array.isArray(rows)) {
          if (window.AppState) window.AppState.suppliers = rows;
          this.rebuildEntityMaps({ suppliers: rows });
        }
        return rows;
      },

      async fetchPurchases(filters = {}, opts = {}) {
        const key = 'purchases:' + JSON.stringify(filters || {});
        const rows = await this.singleFlightFetch(key, () => {
          if (window.api && typeof window.api.getPurchases === 'function') {
            return window.api.getPurchases(filters);
          }
          return [];
        }, opts);
        if (Array.isArray(rows)) {
          if (window.AppState) window.AppState.purchases = rows;
          this.rebuildEntityMaps({ purchases: rows });
        }
        return rows;
      },

      // نافذة العرض التدريجي للجداول الضخمة (> 80 صف) لمنع تجمّد المتصفح في المخزون والمبيعات
      applyRowWindowing(tbody, initialCount = ROW_WINDOW_INITIAL, stepCount = ROW_WINDOW_STEP) {
        if (!tbody || tbody._s4ApplyingWindow) return 0;
        const dataRows = Array.from(tbody.children).filter(
          (tr) => tr.tagName === 'TR' && !tr.classList.contains('s4-load-more-row')
        );

        // إزالة أي زر "عرض المزيد" قديم قبل إعادة الحساب
        const oldMore = tbody.querySelector('tr.s4-load-more-row');
        if (oldMore) oldMore.remove();

        if (dataRows.length <= initialCount + 15) {
          for (let i = 0; i < dataRows.length; i++) {
            dataRows[i].classList.remove('s4-deferred-row');
          }
          return dataRows.length;
        }

        tbody._s4ApplyingWindow = true;
        try {
          let visibleLimit = initialCount;
          const total = dataRows.length;
          const colSpan = Math.max(1, (dataRows[0] && dataRows[0].children ? dataRows[0].children.length : 8));

          const syncVisibility = () => {
            for (let i = 0; i < total; i++) {
              if (i < visibleLimit) dataRows[i].classList.remove('s4-deferred-row');
              else dataRows[i].classList.add('s4-deferred-row');
            }
          };

          syncVisibility();

          const moreRow = document.createElement('tr');
          moreRow.className = 's4-load-more-row';
          const td = document.createElement('td');
          td.colSpan = colSpan;

          const updateControls = () => {
            const remaining = Math.max(0, total - visibleLimit);
            if (remaining <= 0) {
              moreRow.remove();
              return;
            }
            const nextBatch = Math.min(stepCount, remaining);
            td.innerHTML =
              '<button type="button" class="s4-load-more-btn">⬇️ عرض ' + nextBatch + ' صفوف إضافية (المتبقي: ' + remaining + ' من ' + total + ')</button>' +
              '<button type="button" class="s4-show-all-btn">عرض الكل (' + total + ')</button>';

            const btnMore = td.querySelector('.s4-load-more-btn');
            const btnAll = td.querySelector('.s4-show-all-btn');
            if (btnMore) {
              btnMore.onclick = () => {
                visibleLimit = Math.min(total, visibleLimit + stepCount);
                syncVisibility();
                updateControls();
              };
            }
            if (btnAll) {
              btnAll.onclick = () => {
                visibleLimit = total;
                syncVisibility();
                updateControls();
              };
            }
          };

          moreRow.appendChild(td);
          tbody.appendChild(moreRow);
          updateControls();
          this.metrics.windowedTables++;
          return visibleLimit;
        } finally {
          tbody._s4ApplyingWindow = false;
        }
      },

      // مراقبة الجداول داخل الشاشات الإدارية الـ 7 لتطبيق النوافذ التدريجية والـ Debounce تلقائياً
      attachManagedViewObservers() {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
        const self = this;

        for (const viewKey of MANAGED_VIEWS) {
          const sec = document.getElementById('view-' + viewKey);
          if (!sec || sec._s4Observed) continue;
          sec._s4Observed = true;

          let rafScheduled = false;
          const scheduleScan = () => {
            if (rafScheduled) return;
            rafScheduled = true;
            requestAnimationFrame(() => {
              rafScheduled = false;
              if (!sec.classList.contains('active')) return;
              const tbodies = sec.querySelectorAll('tbody');
              tbodies.forEach((tb) => {
                const rawLen = tb.children ? tb.children.length : 0;
                if (rawLen > ROW_WINDOW_INITIAL + 15 && !tb.querySelector('tr.s4-load-more-row')) {
                  self.applyRowWindowing(tb, ROW_WINDOW_INITIAL, ROW_WINDOW_STEP);
                }
              });
              self.debounceViewSearchInputs(sec);
            });
          };

          const obs = new MutationObserver((mutations) => {
            for (let i = 0; i < mutations.length; i++) {
              const target = mutations[i].target;
              if (target && target.classList && target.classList.contains('s4-load-more-row')) continue;
              scheduleScan();
              break;
            }
          });
          obs.observe(sec, { childList: true, subtree: true });
        }
      },

      // تخفيف مدخلات البحث داخل الشاشات الإدارية الـ 7 بـ Debounce (130ms) بدون كسر أحداث oninput
      debounceViewSearchInputs(container) {
        if (!container || typeof container.querySelectorAll !== 'function') return;
        const inputs = container.querySelectorAll('input[type="text"], input[type="search"]');
        const self = this;

        inputs.forEach((inp) => {
          if (inp._s4Debounced) return;
          const inlineHandler = inp.getAttribute('oninput');
          if (!inlineHandler) return;
          const ph = String(inp.getAttribute('placeholder') || '').toLowerCase();
          const id = String(inp.id || '').toLowerCase();
          const isSearch =
            id.includes('search') ||
            id.includes('filter') ||
            ph.includes('بحث') ||
            ph.includes('ابحث') ||
            ph.includes('search') ||
            ph.includes('filtr');
          if (!isSearch) return;

          inp._s4Debounced = true;
          const originalFn = inp.oninput;
          if (typeof originalFn !== 'function') return;

          let timer = null;
          inp.oninput = function debouncedSearchHandler(ev) {
            self.metrics.debouncedSearches++;
            const ctx = this;
            clearTimeout(timer);
            timer = setTimeout(() => {
              try { originalFn.call(ctx, ev); } catch (_) {}
            }, SEARCH_DEBOUNCE_MS);
          };
        });
      },

      // ربط عمليات الحفظ والحذف في App بإبطال الكاش الفوري وتحديث الفهارس (بدون المساس بـ __gherbiMasterPrintSilent)
      hookAppMutationsAndViews() {
        const app = window.App;
        if (!app || app._s4Hooked) return false;
        app._s4Hooked = true;
        const self = this;

        // 1. إبطال تلقائي بعد أي عملية تعديل/حذف/حفظ
        const MUTATION_METHODS = [
          'saveProductFromModal',
          'deleteProduct',
          'submitNewBatchFromModal',
          'submitPurchaseInvoice',
          'deletePurchase',
          'submitSupplierReturnFromModal',
          'saveCustomerFromModal',
          'deleteCustomer',
          'submitCustomerPaymentModal',
          'saveSupplierFromModal',
          'deleteSupplier',
          'submitSupplierPaymentModal',
          'submitSale',
          'deleteSale',
          'confirmIssueCreditNote',
          'saveCartAsProforma',
          'confirmSaveAsOrder'
        ];

        for (const mName of MUTATION_METHODS) {
          if (typeof app[mName] !== 'function') continue;
          const orig = app[mName].bind(app);
          app[mName] = async function s4MutationWrapped(...args) {
            const res = await orig(...args);
            self.invalidate('all');
            setTimeout(() => self.rebuildEntityMaps(), 80);
            return res;
          };
        }

        // 2. إعادة فحص الجداول والمدخلات عند تبديل الشاشات عبر App.switchView
        if (typeof app.switchView === 'function') {
          const origSwitch = app.switchView.bind(app);
          app.switchView = async function s4SwitchView(viewName, ...rest) {
            const out = await origSwitch(viewName, ...rest);
            if (MANAGED_VIEWS.includes(viewName)) {
              setTimeout(() => {
                self.rebuildEntityMaps();
                const sec = document.getElementById('view-' + viewName);
                if (sec) {
                  self.debounceViewSearchInputs(sec);
                  sec.querySelectorAll('tbody').forEach((tb) => {
                    if (tb.children && tb.children.length > ROW_WINDOW_INITIAL + 15) {
                      self.applyRowWindowing(tb, ROW_WINDOW_INITIAL, ROW_WINDOW_STEP);
                    }
                  });
                }
              }, 120);
            }
            return out;
          };
        }

        return true;
      },

      getDiagnostics() {
        return {
          version: this.version,
          revision: this.revision,
          indexedCounts: {
            products: this.maps.productsById.size,
            customers: this.maps.customersById.size,
            suppliers: this.maps.suppliersById.size,
            sales: this.maps.salesById.size,
            purchases: this.maps.purchasesById.size
          },
          metrics: { ...this.metrics }
        };
      },

      boot() {
        this.rebuildEntityMaps();
        this.attachManagedViewObservers();
        this.hookAppMutationsAndViews();

        let tries = 0;
        const timer = setInterval(() => {
          tries++;
          const ok = this.hookAppMutationsAndViews();
          this.attachManagedViewObservers();
          if (ok && tries >= 5) {
            this.rebuildEntityMaps();
            clearInterval(timer);
          } else if (tries >= 40) {
            clearInterval(timer);
          }
        }, 150);

        console.log('⚡ [WAR STAGE 4]: محرك التوربو للمخزون والمبيعات والمشتريات والأطراف جاهز 100% (GherbiStage4Turbo).');
      }
    };

    window.GherbiStage4Turbo = Stage4;
    Stage4.boot();
  })();
})();
