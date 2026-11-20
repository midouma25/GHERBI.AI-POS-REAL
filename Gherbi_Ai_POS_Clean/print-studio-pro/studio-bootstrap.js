/**
 * print-studio-pro/studio-bootstrap.js
 * بوابة العزل المعماري وحماية #print-view-root وتعطيل renderPrintStudioView القديمة (v1.1)
 */
'use strict';
(function buildUpgradedStudioBootstrapModule() {
  (function initPrintStudioProBootstrap() {
    'use strict';

    if (window.GherbiPrintStudioPro && window.GherbiPrintStudioPro._bootstrapped) {
      return;
    }

    const PSP = {
      _bootstrapped: true,
      version: '1.1.0-clean-room-quiesced',
      stage: 1,
      modules: {
        bootstrap: true,
        templates34: false,
        state: false,
        renderer: false,
        ui: false,
        router: false
      },
      _mounted: false,
      _observer: null,
      _legacyQuiesced: false,

      isPrintViewActive() {
        const sec = document.getElementById('view-print');
        return Boolean(sec && sec.classList.contains('active'));
      },

      syncBodyViewClass() {
        const active = this.isPrintViewActive();
        if (document.body && document.body.classList) {
          document.body.classList.toggle('psp-view-open', active);
        }
      },

      getMountRoot() {
        return document.getElementById('print-view-root');
      },

      renderStage1StatusCard(rootEl) {
        const m = this.modules;
        const badge = (ok, label) =>
          `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;border:1px solid var(--psp-border);background:var(--psp-surface-alt);font-size:12px;font-weight:800;">
            <span>${label}</span>
            <span class="psp-badge ${ok ? 'psp-badge-default' : 'psp-badge-paper'}">${ok ? '✅ جاهز ومفعّل' : '⏳ قيد التحميل'}</span>
          </div>`;

        rootEl.innerHTML = `
          <div class="psp-root" data-gherbi-print-v2="1" data-psp-studio="1">
            <div class="psp-topbar">
              <div class="psp-topbar-group">
                <div class="psp-brand-pill">
                  <span class="psp-brand-icon"><span class="material-symbols-rounded" style="font-size:18px;">print</span></span>
                  <span>مركز الطباعة الشامل — Gherbi Print Studio Pro</span>
                </div>
                <span class="psp-badge psp-badge-default">Clean-Room Architecture</span>
              </div>
            </div>
            <div class="psp-gallery-shell">
              <div class="psp-stage1-shell">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;">
                  ${badge(true, '1. studio-pro.css')}
                  ${badge(m.bootstrap, '2. studio-bootstrap.js')}
                  ${badge(m.state, '3. studio-state.js')}
                  ${badge(m.renderer, '4. studio-renderer.js')}
                  ${badge(m.templates34, '5. studio-templates-34.js')}
                  ${badge(m.ui, '6. studio-ui.js')}
                  ${badge(m.router, '7. studio-router.js')}
                </div>
              </div>
            </div>
          </div>
        `;
      },

      mount(rootOverride) {
        const rootEl = rootOverride || this.getMountRoot();
        if (!rootEl) return;
        this.syncBodyViewClass();

        if (this.ui && typeof this.ui.mount === 'function') {
          this.ui.mount(rootEl);
        } else {
          this.renderStage1StatusCard(rootEl);
        }
        this._mounted = true;
      },

      installDomBoundaryGuard() {
        const rootEl = this.getMountRoot();
        if (!rootEl || this._observer || typeof MutationObserver !== 'function') return;

        this._observer = new MutationObserver(() => {
          const hasLegacy = Array.from(rootEl.children).some(
            (child) => child.getAttribute('data-psp-studio') !== '1'
          );
          if (hasLegacy) {
            Array.from(rootEl.children).forEach((child) => {
              if (child.getAttribute('data-psp-studio') !== '1') {
                child.remove();
              }
            });
            if (!rootEl.querySelector('[data-psp-studio="1"]') && this.isPrintViewActive()) {
              this.mount(rootEl);
            }
          }
        });

        this._observer.observe(rootEl, { childList: true });
      },

      quiesceLegacyStudioUi() {
        // 1. تعطيل واجهة GherbiPrintStudioV45 القديمة
        const legacy = window.GherbiPrintStudioV45;
        if (legacy && !legacy._pspUiQuiesced) {
          const safeRedirectRender = async (rootEl) => {
            this.mount(rootEl || this.getMountRoot());
          };

          try {
            const desc = Object.getOwnPropertyDescriptor(legacy, 'renderStudioIntoRoot');
            if (!desc || desc.configurable) {
              Object.defineProperty(legacy, 'renderStudioIntoRoot', {
                get() { return safeRedirectRender; },
                set() {},
                configurable: true
              });
            } else {
              legacy.renderStudioIntoRoot = safeRedirectRender;
            }
          } catch (_) {
            try { legacy.renderStudioIntoRoot = safeRedirectRender; } catch (__) {}
          }

          try {
            legacy.openAndRenderStudio = async () => {
              this.mount(this.getMountRoot());
            };
          } catch (_) {}

          legacy._pspUiQuiesced = true;
          this._legacyQuiesced = true;
        }

        // 2. تعطيل renderPrintStudioView و refreshLabelStudioPreview القديمتين في renderer.js / renderer-rc-100.js
        //    لمنع خطأ (Cannot read properties of null reading 'document') وتسريع فتح مركز الطباعة
        const app = window.App;
        if (app && !app._pspLegacyPrintMethodsQuiesced) {
          const cleanPrintViewHandler = async () => {
            this.installDomBoundaryGuard();
            this.mount(this.getMountRoot());
            return true;
          };

          const safeNoOpLabelPreview = () => {
            // إذا كان iframe قديم غير موجود أو contentWindow يساوي null لا نرمي أي خطأ
            return false;
          };

          try {
            const d1 = Object.getOwnPropertyDescriptor(app, 'renderPrintStudioView');
            if (!d1 || d1.configurable) {
              Object.defineProperty(app, 'renderPrintStudioView', {
                get() { return cleanPrintViewHandler; },
                set() {},
                configurable: true
              });
            } else {
              app.renderPrintStudioView = cleanPrintViewHandler;
            }
          } catch (_) {
            try { app.renderPrintStudioView = cleanPrintViewHandler; } catch (__) {}
          }

          try {
            const d2 = Object.getOwnPropertyDescriptor(app, 'refreshLabelStudioPreview');
            if (!d2 || d2.configurable) {
              Object.defineProperty(app, 'refreshLabelStudioPreview', {
                get() { return safeNoOpLabelPreview; },
                set() {},
                configurable: true
              });
            } else {
              app.refreshLabelStudioPreview = safeNoOpLabelPreview;
            }
          } catch (_) {
            try { app.refreshLabelStudioPreview = safeNoOpLabelPreview; } catch (__) {}
          }

          app._pspLegacyPrintMethodsQuiesced = true;
        }
      },

      hookAppSwitchView() {
        const app = window.App;
        if (!app || typeof app.switchView !== 'function' || app._pspViewHooked) return;
        const origSwitch = app.switchView.bind(app);
        app._pspViewHooked = true;
        app.switchView = async function (viewName, ...rest) {
          // تفعيل التهدئة قبل تشغيل switchView القديم لضمان عدم استدعاء refreshLabelStudioPreview أبداً
          if (viewName === 'print') {
            PSP.quiesceLegacyStudioUi();
          }
          let res;
          try {
            res = await origSwitch(viewName, ...rest);
          } catch (err) {
            if (viewName === 'print') {
              console.warn('[Print Studio Pro]: تم احتواء خطأ واجهة الطباعة القديمة بنجاح:', err && err.message);
            } else {
              throw err;
            }
          }
          PSP.syncBodyViewClass();
          if (viewName === 'print') {
            PSP.installDomBoundaryGuard();
            PSP.quiesceLegacyStudioUi();
            PSP.mount();
          }
          return res;
        };
      },

      start() {
        const tryBind = () => {
          this.installDomBoundaryGuard();
          this.quiesceLegacyStudioUi();
          this.hookAppSwitchView();
          this.syncBodyViewClass();
          if (this.isPrintViewActive() && !document.querySelector('#print-view-root [data-psp-studio="1"]')) {
            this.mount();
          }
        };

        tryBind();
        let polls = 0;
        const timer = setInterval(() => {
          polls++;
          tryBind();
          if (
            (this._legacyQuiesced &&
              window.App &&
              window.App._pspViewHooked &&
              window.App._pspLegacyPrintMethodsQuiesced) ||
            polls >= 40
          ) {
            clearInterval(timer);
          }
        }, 120);

        console.log('🏛️ [Print Studio Pro — Bootstrap v1.1]: العزل الكامل وتعطيل renderPrintStudioView القديمة نشط 100%.');
      }
    };

    window.GherbiPrintStudioPro = PSP;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => PSP.start());
    } else {
      PSP.start();
    }
  })();
})();
