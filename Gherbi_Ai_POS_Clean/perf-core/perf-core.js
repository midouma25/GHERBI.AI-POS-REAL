/**
 * perf-core/perf-core.js
 * الشطر 2 (v2.1): المحرك العام للأداء وحوكمة المؤقتات و Proxy آمن لـ contextBridge
 */
'use strict';
(function buildSafePerfCoreModule() {
  (function initGherbiPerfCore() {
    'use strict';

    if (window.GherbiPerfCore && window.GherbiPerfCore._installed) {
      return;
    }

    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const nativeRaf =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (cb) => setTimeout(cb, 16);

    const READ_TTL_MAP = {
      getProducts: 1800,
      getPosStock: 1800,
      getCategories: 4000,
      getFamilies: 4000,
      getProductSuppliers: 4000,
      getSuppliers: 2500,
      getSettings: 3000,
      getUsers: 4000,
      getBundles: 2500,
      getPromotions: 2500,
      getProformas: 1500,
      getOrders: 1500,
      getPurchases: 1500,
      getExpenses: 1500,
      getCapital: 2000,
      getCaisseSessions: 1200,
      getSales: 700,
      getCustomers: 600,
      getCustomersDebt: 600,
      getActiveSession: 600
    };

    const WRITE_PREFIX_RE =
      /^(add|update|delete|save|create|process|openCaisse|closeCaisse|confirm|reverse|cancel|issue|mark|convert|toggle|merge|set|setup|restore|import|reset)/;

    const PerfCore = {
      _installed: true,
      version: '2.1.0-war-stage2-contextbridge-safe',
      activeView: 'pos',
      ipcCacheMode: 'pending',
      api: null,

      _intervals: new Map(),
      _viewIntervals: new Map(),
      _enterListeners: new Map(),
      _leaveListeners: new Map(),
      _rafPending: new Map(),

      _ipcCache: new Map(),
      _ipcInflight: new Map(),
      _ipcWrapped: false,

      metrics: {
        skippedHiddenTicks: 0,
        skippedInactiveViewTicks: 0,
        skippedOverlapTicks: 0,
        quiescedLegacyIntervals: 0,
        ipcCacheHits: 0,
        ipcInflightCoalesced: 0,
        ipcCacheInvalidations: 0,
        lastViewSwitchMs: 0,
        viewSwitchCount: 0
      },

      getActiveView() {
        if (typeof document !== 'undefined' && document.querySelector) {
          const activeSec = document.querySelector('.view-section.active');
          if (activeSec && activeSec.id && activeSec.id.startsWith('view-')) {
            this.activeView = activeSec.id.slice(5);
          }
        }
        return this.activeView || 'pos';
      },

      debounce(fn, waitMs = 150) {
        let timer = null;
        return function debounced(...args) {
          clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
          }, waitMs);
        };
      },

      rafBatch(key, fn) {
        const k = String(key || 'default');
        if (this._rafPending.has(k)) return;
        this._rafPending.set(k, true);
        nativeRaf(() => {
          this._rafPending.delete(k);
          try { fn(); } catch (e) { console.warn('[PerfCore rAF Warning]:', e.message); }
        });
      },

      onViewEnter(viewName, fn) {
        const v = String(viewName || '*');
        if (!this._enterListeners.has(v)) this._enterListeners.set(v, new Set());
        this._enterListeners.get(v).add(fn);
        return () => this._enterListeners.get(v)?.delete(fn);
      },

      onViewLeave(viewName, fn) {
        const v = String(viewName || '*');
        if (!this._leaveListeners.has(v)) this._leaveListeners.set(v, new Set());
        this._leaveListeners.get(v).add(fn);
        return () => this._leaveListeners.get(v)?.delete(fn);
      },

      registerViewInterval(viewName, fn, delayMs = 1000) {
        const targetView = String(viewName || 'pos');
        let running = false;
        const wrapped = () => {
          if (typeof document !== 'undefined' && document.hidden) {
            this.metrics.skippedHiddenTicks++;
            return;
          }
          if (this.getActiveView() !== targetView) {
            this.metrics.skippedInactiveViewTicks++;
            return;
          }
          if (running) {
            this.metrics.skippedOverlapTicks++;
            return;
          }
          running = true;
          try {
            const out = fn();
            if (out && typeof out.finally === 'function') {
              out.finally(() => { running = false; });
            } else {
              running = false;
            }
          } catch (_) {
            running = false;
          }
        };
        const id = nativeSetInterval(wrapped, Math.max(50, Number(delayMs || 1000)));
        this._viewIntervals.set(id, { viewName: targetView, delayMs });
        return id;
      },

      unregisterViewInterval(id) {
        this._viewIntervals.delete(id);
        nativeClearInterval(id);
      },

      invalidateCache(reason = '') {
        this._ipcCache.clear();
        this.metrics.ipcCacheInvalidations++;
        if (reason) this._lastInvalidationReason = reason;
      },

      // بناء Proxy آمن للكاش وتوحيد الطلبات دون تعديل أي خاصية مجمّدة على window.api
      _createCachedApiProxy(rawApi) {
        const self = this;
        const wrappedFns = new Map();

        return new Proxy({}, {
          get(target, prop) {
            const val = rawApi[prop];
            if (typeof prop !== 'string' || typeof val !== 'function') {
              return val;
            }
            if (wrappedFns.has(prop)) {
              return wrappedFns.get(prop);
            }

            const origFn = val.bind(rawApi);

            if (Object.prototype.hasOwnProperty.call(READ_TTL_MAP, prop)) {
              const ttlMs = READ_TTL_MAP[prop];
              const readWrapper = function cachedReadProxy(...args) {
                let argKey = '';
                try {
                  argKey = args.length > 0 ? JSON.stringify(args) : '';
                } catch (_) {
                  return origFn(...args);
                }
                const cacheKey = `${prop}:${argKey}`;
                const now = Date.now();

                const cached = self._ipcCache.get(cacheKey);
                if (cached && now - cached.ts <= ttlMs) {
                  self.metrics.ipcCacheHits++;
                  const cv = cached.value;
                  return Promise.resolve(Array.isArray(cv) ? cv.slice() : cv);
                }

                if (self._ipcInflight.has(cacheKey)) {
                  self.metrics.ipcInflightCoalesced++;
                  return self._ipcInflight.get(cacheKey).then((cv) =>
                    Array.isArray(cv) ? cv.slice() : cv
                  );
                }

                const p = Promise.resolve()
                  .then(() => origFn(...args))
                  .then((res) => {
                    self._ipcInflight.delete(cacheKey);
                    self._ipcCache.set(cacheKey, { ts: Date.now(), value: res });
                    return Array.isArray(res) ? res.slice() : res;
                  })
                  .catch((err) => {
                    self._ipcInflight.delete(cacheKey);
                    throw err;
                  });

                self._ipcInflight.set(cacheKey, p);
                return p;
              };
              wrappedFns.set(prop, readWrapper);
              return readWrapper;
            }

            if (WRITE_PREFIX_RE.test(prop)) {
              const writeWrapper = function invalidatingWriteProxy(...args) {
                self.invalidateCache(prop);
                const out = origFn(...args);
                if (out && typeof out.then === 'function') {
                  return out.then((res) => {
                    self.invalidateCache(prop);
                    return res;
                  });
                }
                return out;
              };
              wrappedFns.set(prop, writeWrapper);
              return writeWrapper;
            }

            wrappedFns.set(prop, origFn);
            return origFn;
          }
        });
      },

      installIpcSmartCache() {
        if (this._ipcWrapped) return true;
        const rawApi = window.api;
        if (!rawApi || typeof rawApi !== 'object') return false;
        this._ipcWrapped = true;

        const cachedProxy = this._createCachedApiProxy(rawApi);
        this.api = cachedProxy;

        // محاولة الربط الشفاف على window.api فقط إذا سمح واصف الخاصية بذلك (بدون رمي أي TypeError أبداً)
        try {
          const winDesc = Object.getOwnPropertyDescriptor(window, 'api');
          if (!winDesc || winDesc.writable) {
            window.api = cachedProxy;
            this.ipcCacheMode = 'window.api-proxy';
            return true;
          }
          if (winDesc.configurable) {
            Object.defineProperty(window, 'api', {
              value: cachedProxy,
              writable: true,
              configurable: true,
              enumerable: true
            });
            this.ipcCacheMode = 'window.api-redefined';
            return true;
          }
        } catch (_) {}

        // إذا كان الكائن نفسه غير مجمّد، نعدّل الخصائص القابلة للكتابة فقط
        if (!Object.isFrozen(rawApi)) {
          let patchedAny = false;
          for (const key of Object.keys(rawApi)) {
            if (!Object.prototype.hasOwnProperty.call(READ_TTL_MAP, key) && !WRITE_PREFIX_RE.test(key)) {
              continue;
            }
            const d = Object.getOwnPropertyDescriptor(rawApi, key);
            if (!d || d.writable) {
              try {
                rawApi[key] = cachedProxy[key];
                patchedAny = true;
              } catch (_) {}
            }
          }
          if (patchedAny) {
            this.ipcCacheMode = 'window.api-inplace';
            return true;
          }
        }

        // وضع Electron contextBridge المجمّد: الكائن محمي ولا يمكن تعديله؛ نُبقي PerfCore.api جاهزاً دون أي خطأ
        this.ipcCacheMode = 'PerfCore.api (contextBridge frozen)';
        return true;
      },

      installSmartTimerGovernance() {
        const self = this;

        window.setInterval = function governedSetInterval(fn, delay, ...args) {
          if (typeof fn !== 'function') {
            return nativeSetInterval(fn, delay, ...args);
          }

          const ms = Number(delay || 0);
          let src = '';
          try { src = Function.prototype.toString.call(fn); } catch (_) {}

          const isCleanPro = src.includes('GherbiPrintStudioPro') || src.includes('GherbiPerfCore');
          const isCritical =
            isCleanPro ||
            ms < 250 ||
            /scale|cloud|sync|clock|toLocaleTimeString|heartbeat|revision/i.test(src);

          let scopedView = null;
          if (!isCleanPro) {
            if (/refreshLivePosDebtBannerAndButtons|v68CustomerLiveDebtBanner|posCartItems/.test(src)) {
              scopedView = 'pos';
            } else if (/v45MasterPrintStudio|v61LeftSidebarHost|renderV75MasterStudio|renderV76MasterStudio/.test(src)) {
              scopedView = '__LEGACY_PRINT__';
            }
          }

          let running = false;
          let timerId = null;

          const wrappedFn = function () {
            if (scopedView === '__LEGACY_PRINT__' && window.GherbiPrintStudioPro && window.GherbiPrintStudioPro._bootstrapped) {
              self.metrics.quiescedLegacyIntervals++;
              if (timerId !== null) {
                self._intervals.delete(timerId);
                nativeClearInterval(timerId);
              }
              return;
            }

            if (!isCritical && typeof document !== 'undefined' && document.hidden) {
              self.metrics.skippedHiddenTicks++;
              return;
            }

            if (scopedView && scopedView !== '__LEGACY_PRINT__' && self.getActiveView() !== scopedView) {
              self.metrics.skippedInactiveViewTicks++;
              return;
            }

            if (running) {
              self.metrics.skippedOverlapTicks++;
              return;
            }

            running = true;
            try {
              const res = fn.apply(this, args);
              if (res && typeof res.finally === 'function') {
                res.finally(() => { running = false; });
              } else {
                running = false;
              }
            } catch (e) {
              running = false;
              throw e;
            }
          };

          timerId = nativeSetInterval(wrappedFn, ms);
          self._intervals.set(timerId, {
            delay: ms,
            scopedView,
            isCritical,
            createdAt: Date.now()
          });
          return timerId;
        };

        window.clearInterval = function governedClearInterval(id) {
          self._intervals.delete(id);
          self._viewIntervals.delete(id);
          return nativeClearInterval(id);
        };
      },

      notifyViewTransition(prevView, nextView, durationMs) {
        this.activeView = nextView;
        this.metrics.lastViewSwitchMs = Number(durationMs.toFixed(1));
        this.metrics.viewSwitchCount++;

        if (typeof document !== 'undefined' && document.body && document.body.dataset) {
          document.body.dataset.activeView = nextView;
        }

        if (prevView && prevView !== nextView) {
          const leaveSet = this._leaveListeners.get(prevView);
          if (leaveSet) leaveSet.forEach((fn) => { try { fn(prevView, nextView); } catch (_) {} });
          const anyLeave = this._leaveListeners.get('*');
          if (anyLeave) anyLeave.forEach((fn) => { try { fn(prevView, nextView); } catch (_) {} });
        }

        const enterSet = this._enterListeners.get(nextView);
        if (enterSet) enterSet.forEach((fn) => { try { fn(nextView, prevView); } catch (_) {} });
        const anyEnter = this._enterListeners.get('*');
        if (anyEnter) anyEnter.forEach((fn) => { try { fn(nextView, prevView); } catch (_) {} });
      },

      hookAppSwitchView() {
        const app = window.App;
        if (!app || typeof app.switchView !== 'function' || app._perfCoreHooked) return false;
        app._perfCoreHooked = true;
        const origSwitch = app.switchView.bind(app);
        const self = this;

        app.switchView = async function perfWrappedSwitchView(viewName, ...rest) {
          const prevView = self.getActiveView();
          const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const result = await origSwitch(viewName, ...rest);
          const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
          self.notifyViewTransition(prevView, String(viewName || self.getActiveView()), Math.max(0, t1 - t0));
          return result;
        };
        return true;
      },

      getDiagnostics() {
        return {
          version: this.version,
          activeView: this.getActiveView(),
          ipcCacheMode: this.ipcCacheMode,
          trackedGlobalIntervals: this._intervals.size,
          trackedViewIntervals: this._viewIntervals.size,
          ipcCacheEntries: this._ipcCache.size,
          ipcWrapped: this._ipcWrapped,
          metrics: { ...this.metrics }
        };
      },

      boot() {
        try { this.installSmartTimerGovernance(); } catch (e) { console.warn('[PerfCore Timer Warning]:', e.message); }
        try { this.installIpcSmartCache(); } catch (e) { console.warn('[PerfCore IPC Warning]:', e.message); }
        try { this.hookAppSwitchView(); } catch (e) { console.warn('[PerfCore SwitchView Warning]:', e.message); }

        let tries = 0;
        const bootTimer = nativeSetInterval(() => {
          tries++;
          let ipcOk = false;
          let viewOk = false;
          try { ipcOk = this.installIpcSmartCache(); } catch (_) {}
          try { viewOk = this.hookAppSwitchView(); } catch (_) {}
          if ((ipcOk && viewOk) || tries >= 50) {
            nativeClearInterval(bootTimer);
          }
        }, 100);

        console.log('⚡ [Gherbi Perf Core v2.1]: نشط 100% — وضع IPC:', this.ipcCacheMode);
      }
    };

    window.GherbiPerfCore = PerfCore;
    PerfCore.boot();
  })();
})();
