/**
 * gherbi-v7-stage2-price-kiosk.js (Updated Navigation Bar Placement & Live Server Catalog Sync)
 * 1. يضع زر "🏷️ شاشة الأسعار للزبائن" داخل شريط أسماء الصفحات (#gherbiEnterpriseTopNav و #sidebar-nav) بدلاً من الهيدر الضيق.
 * 2. يصلح عرض رابط الشبكة (http://192.168.x.x:8080/kiosk) بدون أي نص زائد.
 * 3. يزامن مصفوفة المنتجات (AppState.products) تلقائياً مع الخادم المحلي لتعمل الشاشة في أي متصفح خارجي بكفاءة 100%.
 */

'use strict';

(function initGherbiV7Stage2Kiosk() {
  const V7Kiosk = {
    standbyTimer: null,
    focusTimer: null,
    lastSyncedCount: 0,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        // إزالة الزر القديم الضيق من الهيدر العلوي إن وجد
        document.getElementById('gherbiOpenAisleKioskBtn')?.remove();

        this.buildKioskOverlayDom();
        this.injectKioskButtonIntoPageNavBars();
        this.startAutomaticCatalogSyncToServer();
        console.log('🚀 [Gherbi V7 - Stage 2 Fixed]: تم نقل زر شاشة الأسعار إلى شريط الصفحات وتفعيل مزامنة المتصفح الخارجي.');
      }, 200);
    },

    // ========================================================================
    // 1. وضع زر "🏷️ شاشة الأسعار للزبائن" في شريط أسماء الصفحات (العلوي والجانبي)
    // ========================================================================
    injectKioskButtonIntoPageNavBars() {
      const ensureNavPlacement = () => {
        // 1. إزالة أي زر قديم في الهيدر الضيق
        document.querySelector('#top-header #gherbiOpenAisleKioskBtn')?.remove();

        // 2. الإضافة في القائمة الجانبية (#sidebar-nav) بدون الكلاس .nav-btn حتى لا ينسخه الشريط العلوي مرتين
        const sideNav = document.getElementById('sidebar-nav');
        if (sideNav) {
          const existingSideBtns = Array.from(sideNav.querySelectorAll('button')).filter((b) =>
            (b.textContent || '').includes('شاشة الأسعار للزبائن')
          );
          if (existingSideBtns.length > 1) {
            existingSideBtns.slice(1).forEach((b) => b.remove());
          }
          if (existingSideBtns.length === 0) {
            const btnSide = document.createElement('button');
            btnSide.id = 'gherbiSideNavKioskBtn';
            btnSide.type = 'button';
            btnSide.onclick = () => this.openKioskMode();
            // لاحظ عدم وضع كلاس nav-btn هنا لمنع النسخ المزدوج إلى الشريط العلوي
            btnSide.className = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white transition font-black';
            btnSide.innerHTML = '<span class="material-symbols-rounded icon-sm">qr_code_scanner</span><span class="sidebar-label font-black">شاشة الأسعار للزبائن</span>';
            const posNavBtn = sideNav.querySelector('button[data-view="pos"]');
            if (posNavBtn && posNavBtn.parentNode === sideNav) {
              sideNav.insertBefore(btnSide, posNavBtn.nextSibling);
            } else {
              sideNav.insertBefore(btnSide, sideNav.firstChild);
            }
          } else {
            existingSideBtns[0].classList.remove('nav-btn');
          }
        }

        // 3. ضمان وجود زر واحد فقط داخل الشريط العلوي (#gherbiEnterpriseTopNav)
        const topNav = document.getElementById('gherbiEnterpriseTopNav');
        if (topNav) {
          const allKioskBtnsInTop = Array.from(topNav.querySelectorAll('button')).filter((b) =>
            (b.textContent || '').includes('شاشة الأسعار للزبائن')
          );

          // إذا وُجد أكثر من زر (الأخضر والأزرق كما في الصورة 1)، نحذف الزائد فوراً
          if (allKioskBtnsInTop.length > 1) {
            allKioskBtnsInTop.slice(1).forEach((dupBtn) => dupBtn.remove());
          }

          let singleTopBtn = allKioskBtnsInTop[0] || null;
          if (!singleTopBtn) {
            singleTopBtn = document.createElement('button');
            if (topNav.firstElementChild) {
              topNav.insertBefore(singleTopBtn, topNav.firstElementChild.nextSibling);
            } else {
              topNav.appendChild(singleTopBtn);
            }
          }

          singleTopBtn.id = 'gherbiTopNavKioskBtn';
          singleTopBtn.type = 'button';
          singleTopBtn.removeAttribute('data-topview');
          singleTopBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.openKioskMode();
          };
          singleTopBtn.className = 'gherbi-topnav-item shrink-0';
          singleTopBtn.style.cssText = 'background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff !important; border: 1px solid #34d399; font-weight: 900; border-radius: 0.6rem; padding: 0.28rem 0.75rem; margin-right: 0.25rem; display: inline-flex; align-items: center; gap: 0.35rem; white-space: nowrap; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);';
          singleTopBtn.innerHTML = '<span class="material-symbols-rounded icon-sm" style="font-size:16px">qr_code_scanner</span><span>شاشة الأسعار للزبائن</span>';
        }
      };

      ensureNavPlacement();
      setInterval(ensureNavPlacement, 400);
    },

    // ========================================================================
    // 2. مزامنة مصفوفة المنتجات (AppState.products) مع الخادم المحلي ليعمل المتصفح الخارجي 100%
    // ========================================================================
    syncCatalogToServerNow() {
      const prods = window.AppState?.products || [];
      if (!Array.isArray(prods) || prods.length === 0) return;

      const payload = JSON.stringify({ products: prods });
      fetch('http://127.0.0.1:8080/api/kiosk/sync-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: payload
      }).catch(() => {
        fetch('http://localhost:8080/api/kiosk/sync-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: payload
        }).catch(() => {});
      });
    },

    startAutomaticCatalogSyncToServer() {
      setTimeout(() => this.syncCatalogToServerNow(), 600);
      setTimeout(() => this.syncCatalogToServerNow(), 2000);
      setInterval(() => {
        const count = (window.AppState?.products || []).length;
        if (count > 0) {
          this.syncCatalogToServerNow();
        }
      }, 8000);
    },

    // ========================================================================
    // 3. بناء وتشغيل شاشة الكشك المدمجة مع إصلاح صيغة عنوان الشبكة
    // ========================================================================
    extractCleanLanUrl() {
      const lanBadge = document.getElementById('lanClientsCountText')?.textContent || '';
      const ipMatch = lanBadge.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      if (ipMatch && ipMatch[1]) {
        return `http://${ipMatch[1]}:8080/kiosk`;
      }
      return 'http://localhost:8080/kiosk';
    },

    buildKioskOverlayDom() {
      const existing = document.getElementById('gherbiAisleKioskOverlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'gherbiAisleKioskOverlay';
      overlay.innerHTML = `
        <!-- الشريط العلوي لشاشة الزبون -->
        <header class="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center text-2xl font-black shadow-lg shadow-emerald-500/30">🏷️</div>
            <div>
              <h2 class="text-lg font-black text-white">شاشة فاحص الأسعار الذاتي للزبائن (Borne de Prix)</h2>
              <p class="text-xs text-emerald-400 font-bold">
                لفتح هذه الشاشة على أي تابلت أو متصفح في المحل افتح الرابط:
                <span id="kioskNetworkUrlHint" class="font-mono underline px-1.5 py-0.5 rounded bg-slate-800 text-amber-300" dir="ltr">http://localhost:8080/kiosk</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2.5 flex-1 max-w-xl">
            <input id="aisleKioskScanInput" type="text"
              oninput="GherbiV7Stage2.onKioskTyping(this.value)"
              onkeydown="if(event.key==='Enter') GherbiV7Stage2.lookupKioskItem(this.value)"
              placeholder="مرر باركود السلعة بالقارئ أو اكتب اسمها هنا..."
              class="flex-1 px-4 py-2.5 rounded-2xl bg-slate-950 border-2 border-emerald-500 text-white font-black text-sm text-center focus:ring-4 focus:ring-emerald-500/30">
            <button type="button" onclick="GherbiV7Stage2.promptExitKioskMode()"
              class="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black text-xs transition shrink-0"
              title="الخروج من وضع شاشة الزبائن (محمي بكود المدير)">
              🔒 خروج للكاشير
            </button>
          </div>
        </header>

        <main id="aisleKioskDisplayArea" class="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto"></main>

        <div id="kioskExitPinBox" class="hidden fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
          <div class="w-full max-w-sm p-5 rounded-2xl bg-slate-900 border-2 border-amber-500 space-y-3 text-center">
            <div class="text-2xl">🔐</div>
            <h4 class="font-black text-sm text-amber-400">أدخل كود المدير للخروج من شاشة الزبائن</h4>
            <p class="text-[11px] text-slate-400">هذه الحماية تمنع الزبائن من إغلاق شاشة الأسعار والدخول للبرنامج (الافتراضي: 1234)</p>
            <input id="kioskExitPinInput" type="password" placeholder="كود المدير..."
              onkeydown="if(event.key==='Enter') GherbiV7Stage2.confirmExitKioskMode()"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500 text-white font-mono font-black text-center text-base tracking-widest">
            <div class="flex items-center justify-center gap-2 pt-1">
              <button type="button" onclick="document.getElementById('kioskExitPinBox').classList.add('hidden'); document.getElementById('aisleKioskScanInput')?.focus();"
                class="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs">إلغاء</button>
              <button type="button" onclick="GherbiV7Stage2.confirmExitKioskMode()"
                class="px-5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs">✔ تأكيد الخروج</button>
            </div>
          </div>
        </div>

        <footer class="px-6 py-3 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-bold">
          <span>🟢 القارئ الضوئي جاهز دائماً — مرر أي سلعة لمعرفة سعرها بالدينار والسنتيم</span>
          <span>تعود الشاشة تلقائياً لوضع الاستعداد بعد 10 ثوانٍ</span>
        </footer>
      `;

      overlay.addEventListener('click', (e) => {
        if (!e.target.closest('#kioskExitPinBox') && e.target.id !== 'aisleKioskScanInput') {
          document.getElementById('aisleKioskScanInput')?.focus();
        }
      });

      document.body.appendChild(overlay);
    },

    openKioskMode() {
      this.syncCatalogToServerNow();
      if (!document.getElementById('gherbiAisleKioskOverlay')) {
        this.buildKioskOverlayDom();
      }
      const overlay = document.getElementById('gherbiAisleKioskOverlay');
      if (!overlay) return;
      overlay.classList.add('active');
      this.renderStandbyScreen();

      const urlHint = document.getElementById('kioskNetworkUrlHint');
      if (urlHint) {
        urlHint.textContent = this.extractCleanLanUrl();
      }

      if (this.focusTimer) clearInterval(this.focusTimer);
      this.focusTimer = setInterval(() => {
        const pinBox = document.getElementById('kioskExitPinBox');
        if (overlay.classList.contains('active') && pinBox && pinBox.classList.contains('hidden')) {
          const inp = document.getElementById('aisleKioskScanInput');
          if (inp && document.activeElement !== inp) inp.focus();
        }
      }, 500);
    },

    promptExitKioskMode() {
      const box = document.getElementById('kioskExitPinBox');
      const inp = document.getElementById('kioskExitPinInput');
      if (!box || !inp) return;
      box.classList.remove('hidden');
      inp.value = '';
      setTimeout(() => inp.focus(), 50);
    },

    confirmExitKioskMode() {
      const entered = String(document.getElementById('kioskExitPinInput')?.value || '').trim();
      const validPin = String(
        window.AppState?.settings?.manager_loyalty_pin ||
        localStorage.getItem('gherbi_manager_loyalty_pin') ||
        '1234'
      ).trim();

      if (entered !== validPin) {
        if (window.showToast) window.showToast('❌ كود المدير غير صحيح!', 'error');
        document.getElementById('kioskExitPinInput')?.focus();
        return;
      }

      document.getElementById('kioskExitPinBox')?.classList.add('hidden');
      document.getElementById('gherbiAisleKioskOverlay')?.classList.remove('active');
      if (this.focusTimer) clearInterval(this.focusTimer);
      if (this.standbyTimer) clearTimeout(this.standbyTimer);
      window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
    },

    renderStandbyScreen() {
      const area = document.getElementById('aisleKioskDisplayArea');
      if (!area) return;
      area.innerHTML = `
        <div class="max-w-2xl space-y-4 animate-pulse">
          <div class="text-7xl">🛒⬇️</div>
          <h1 class="text-3xl md:text-4xl font-black text-white leading-snug">
            مرحباً بكم! مرّر باركود السلعة أمام القارئ لمعرفة السعر فوراً
          </h1>
          <p class="text-base md:text-lg text-slate-300 font-bold">
            يعرض السعر بالدينار الجزائري وبالسنتيم مع تسعيرة الكارطون والحزم العائلية
          </p>
        </div>
      `;
    },

    normalizeAr(str) {
      return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه');
    },

    onKioskTyping(val) {
      const q = String(val || '').trim();
      if (q.length >= 2 && !/^\d+$/.test(q)) {
        this.lookupKioskItem(q, false);
      }
    },

    lookupKioskItem(rawQuery, clearInput = true) {
      const q = String(rawQuery || '').trim();
      const inp = document.getElementById('aisleKioskScanInput');
      if (clearInput && inp) inp.value = '';
      if (!q) return;

      const area = document.getElementById('aisleKioskDisplayArea');
      if (!area) return;

      const products = window.AppState?.products || [];
      let matchedProd = null;
      let matchedCustomPrice = null;

      if (window.GherbiV4Stage3 && typeof window.GherbiV4Stage3.findByAnyBarcode === 'function') {
        const subMatch = window.GherbiV4Stage3.findByAnyBarcode(q);
        if (subMatch && subMatch.product) {
          matchedProd = subMatch.product;
          matchedCustomPrice = subMatch.customPrice;
        }
      }

      if (!matchedProd) {
        const qNorm = this.normalizeAr(q);
        matchedProd = products.find(
          (p) =>
            String(p.barcode || '').toLowerCase() === q.toLowerCase() ||
            String(p.plu_code || '').toLowerCase() === q.toLowerCase() ||
            this.normalizeAr(p.name || '').includes(qNorm)
        );
      }

      if (!matchedProd) {
        area.innerHTML = `
          <div class="p-8 rounded-3xl bg-rose-950/60 border-2 border-rose-500 max-w-xl w-full space-y-3">
            <div class="text-5xl">⚠️</div>
            <div class="text-2xl font-black text-rose-300">لم يتم العثور على سلعة مطابقة لـ (${q})</div>
            <div class="text-sm font-bold text-slate-300">يرجى إعادة تمرير الباركود بوضوح أو استشارة البائع في الصندوق</div>
          </div>
        `;
      } else {
        const unitPrice = matchedCustomPrice !== null
          ? Number(matchedCustomPrice)
          : Number(matchedProd.selling_price ?? matchedProd.price ?? 0);
        const centimes = Math.round(unitPrice * 100).toLocaleString('fr-DZ');
        const packPrice = Number(matchedProd.wholesale_price || 0);
        const packQty = Number(matchedProd.wholesale_qty || matchedProd.wholesale_min_qty || 0);
        const stock = Number(matchedProd.total_stock ?? matchedProd.stock ?? 0);

        area.innerHTML = `
          <div class="p-8 rounded-3xl bg-slate-900/95 border-4 border-emerald-500 max-w-3xl w-full space-y-4 shadow-2xl">
            <div class="flex items-center justify-center gap-2 flex-wrap">
              <span class="px-4 py-1 rounded-full bg-blue-500/20 text-blue-300 font-black text-sm">🏷️ ${matchedProd.category || 'سلعة متوفرة'}</span>
              ${matchedProd.barcode ? `<span class="px-4 py-1 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-sm">${matchedProd.barcode}</span>` : ''}
            </div>

            <div class="text-3xl md:text-4xl font-black text-white leading-tight">${matchedProd.name}</div>

            <div class="py-3 px-6 rounded-2xl bg-slate-950/90 border border-emerald-500/40 inline-block">
              <div class="text-xs font-bold text-slate-400 mb-1">سعر البيع للزبون</div>
              <div class="kiosk-price-glow">${unitPrice.toFixed(2)} د.ج</div>
              <div class="text-xl md:text-2xl font-black text-amber-400 mt-2">🇩🇿 بالسنتيم: ${centimes} سنتيم</div>
            </div>

            <div class="flex items-center justify-center gap-3 flex-wrap pt-2">
              <div class="px-4 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-sm">
                📦 الحالة: ${stock > 0 ? `متوفر في المحل (${stock} ${matchedProd.unit || 'قطعة'})` : 'متوفر'}
              </div>
              ${
                packPrice > 0 && packQty > 1
                  ? `<div class="px-4 py-2 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-black text-sm">
                       🎁 سعر الكارطون / الحزمة (×${packQty}): <span class="font-mono text-amber-300">${packPrice.toFixed(2)} د.ج</span>
                     </div>`
                  : ''
              }
            </div>
          </div>
        `;
      }

      if (this.standbyTimer) clearTimeout(this.standbyTimer);
      this.standbyTimer = setTimeout(() => {
        this.renderStandbyScreen();
      }, 10000);
    }
  };

  window.GherbiV7Stage2 = V7Kiosk;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V7Kiosk.init());
  } else {
    V7Kiosk.init();
  }
})();
