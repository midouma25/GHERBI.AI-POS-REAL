/**
 * print-studio-pro/studio-ui.js
 * المرحلة 4: الواجهة العالمية لمركز الطباعة (Gallery + Visual Studio + Barcodes + Free Editor)
 */
'use strict';
(function buildStudioUiModule() {
  (function initPrintStudioProUI() {
    'use strict';

    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state || !PSP.renderer) return;

    const { fmtDzd, fmtCentimes } = PSP.utils;

    function esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function toast(msg, type = 'success') {
      if (typeof window.showToast === 'function') return window.showToast(msg, type);
      if (window.App && typeof window.App.showToast === 'function') return window.App.showToast(msg, type);
      if (window.App && typeof window.App.toast === 'function') return window.App.toast(msg, type);
    }

    // طباعة أو تصدير PDF موحّد (يستخدم router عند تحميله في المرحلة 5 أو جسور main.js المباشرة الآن)
    async function dispatchPrintOrPdf(fullHtml, paperSize = '80mm', asPdf = false, docId = 'document') {
      if (PSP.router && typeof PSP.router.executePrintHtml === 'function') {
        return await PSP.router.executePrintHtml({ html: fullHtml, paperSize, asPdf, docId });
      }
      try {
        if (asPdf && window.api && typeof window.api.exportHtmlToPdf === 'function') {
          return await window.api.exportHtmlToPdf({ html: fullHtml, filename: `${docId}.pdf`, paperSize });
        }
        if (asPdf && window.api && typeof window.api.printToPdf === 'function') {
          return await window.api.printToPdf({ html: fullHtml, filename: `${docId}.pdf`, paperSize });
        }
        if (!asPdf && typeof window.__gherbiMasterPrintSilent === 'function') {
          return await window.__gherbiMasterPrintSilent({ html: fullHtml, paperSize, silent: false });
        }
        if (window.api && typeof window.api.printHtml === 'function') {
          return await window.api.printHtml({ html: fullHtml, paperSize, silent: false });
        }
      } catch (e) {
        console.warn('[PSP Print Dispatch Warning]:', e.message);
      }

      // بديل مضمون عبر iframe مخفي
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;right:-9999px;bottom:-9999px;width:0;height:0;border:0;';
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(fullHtml);
      iframe.contentDocument.close();
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (_) {}
        setTimeout(() => iframe.remove(), 1500);
      }, 220);
    }

    // توليد أشرطة باركود بصرية نظيفة (SVG Code-like Visual Bars) للمعاينة والطباعة السريعة
    function buildBarcodeSvg(codeText, heightPx = 34) {
      const str = String(codeText || '6130001000012').trim();
      let bars = '';
      let x = 2;
      for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        const w1 = (ch % 2) + 1.2;
        const g1 = ((ch >> 1) % 2) + 1;
        const w2 = ((ch >> 2) % 2) + 1;
        const g2 = ((ch >> 3) % 2) + 1.2;
        bars += `<rect x="${x.toFixed(1)}" y="0" width="${w1.toFixed(1)}" height="${heightPx}" fill="#0f172a"/>`;
        x += w1 + g1;
        bars += `<rect x="${x.toFixed(1)}" y="0" width="${w2.toFixed(1)}" height="${heightPx}" fill="#0f172a"/>`;
        x += w2 + g2;
      }
      const totalW = Math.max(90, Math.ceil(x + 2));
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${heightPx}" style="width:100%;max-width:165px;height:${heightPx}px;display:block;margin:2px auto;">${bars}</svg>`;
    }

    const UI = {
      _mountEl: null,
      _delegatedRoot: null,
      _rafPaper: false,
      _historyDebounce: null,
      _shopSaveTimer: null,

      // حالة الواجهة المحلية
      galleryCategory: 'ALL',
      gallerySearch: '',
      expandedSectionId: null,
      showOptionalSections: false,
      availablePrinters: [],

      // بيانات الفواتير الحقيقية للمعاينة
      realSalesList: [],
      realSaleIndex: 0,
      realSaleDocCache: null,

      // حالة تبويب الباركود
      barcodeState: {
        search: '',
        products: [],
        queue: [], // [{ id, name, barcode, price, qty }]
        size: '40x25', // '40x25' | '50x30' | '60x40' | 'a4'
        showShop: true,
        showName: true,
        showPrice: true,
        showCentimes: false,
        showCodeText: true
      },

      // حالة تبويب المحرر الحر (Word)
      wordState: {
        paperSize: 'a4',
        includeShopHeader: true,
        title: 'وثيقة رسمية / إعلان للمتجر',
        htmlBody: `<h2 style="text-align:center;margin:0 0 12px;">إعلان وتنبيه للزبائن الكرام</h2>
<p>يسعدنا في متجرنا أن نعلن لزبائننا الأوفياء عن توفير كافة المستلزمات بأسعار تنافسية وجودة مضمونة، مع إمكانية الاستفادة من بطاقة الوفاء ونقاط التخفيض الفوري.</p>
<p><strong>شروط العمل:</strong> البضاعة المباعة تستبدل خلال 48 ساعة بشرط إحضار الوصل الأصلي وسلامة الغلاف.</p>`
      },

      // ======================================================================
      // 1. جلب أحدث الفواتير الحقيقية والمنتجات من SQLite عند الحاجة
      // ======================================================================
      async loadRealSalesIfNeeded(force = false) {
        if (!force && this.realSalesList.length > 0) return;
        try {
          const rows = window.api && typeof window.api.getSales === 'function'
            ? await window.api.getSales({})
            : [];
          if (Array.isArray(rows)) {
            this.realSalesList = rows.slice(0, 25);
          }
        } catch (_) {}
      },

      async loadRealSaleAtCursor() {
        await this.loadRealSalesIfNeeded(false);
        const head = this.realSalesList[this.realSaleIndex];
        if (!head) {
          this.realSaleDocCache = null;
          return;
        }
        try {
          const det = window.api && typeof window.api.getSaleDetails === 'function'
            ? await window.api.getSaleDetails(Number(head.id))
            : head;
          const items = det && Array.isArray(det.items)
            ? det.items.map((it) => ({
                barcode: it.product_barcode || it.barcode || '-',
                name: it.product_name || it.custom_product_name || it.name || 'صنف',
                unit: it.product_unit || it.unit || 'قطعة',
                qty: Number(it.quantity ?? it.qty ?? 1),
                price: Number(it.price || 0),
                discount: Number(it.discount || 0),
                tva: Number(it.tva || 0),
                subtotal: Number(it.subtotal ?? Number(it.price || 0) * Number(it.quantity || 1))
              }))
            : [];
          const cid = Number(det?.customer_id || head.customer_id || 0);
          const total = Number(det?.total ?? head.total ?? 0);
          const paid = Number(det?.paid_amount ?? head.paid_amount ?? total);

          this.realSaleDocCache = {
            docNumber: det?.doc_number || head.doc_number || String(head.id),
            date: String(det?.sale_date || head.sale_date || new Date().toISOString()).replace('T', ' ').slice(0, 16),
            customerId: cid > 0 ? cid : null,
            isWalkinCustomer: cid <= 0,
            partyTitle: 'الزبون:',
            partyName: cid > 0 ? (det?.customer_name || `زبون #${cid}`) : 'زبون عابر (Comptoir)',
            partyPhone: det?.customer_phone || '',
            partyAddress: det?.customer_address || '',
            paymentMethod: det?.payment_method === 'credit' ? 'بيع بالدين (À Terme)' : 'نقداً (Espèces)',
            items,
            subtotal: Number(det?.subtotal ?? total),
            discount: Number(det?.discount || 0),
            stampAmount: Number(det?.stamp_amount || 0),
            total,
            paidAmount: paid,
            receivedAmount: paid,
            remainingDebt: Math.max(0, Number((total - paid).toFixed(2)))
          };
        } catch (_) {
          this.realSaleDocCache = null;
        }
      },

      async loadProductsForBarcodesIfNeeded() {
        if (this.barcodeState.products.length > 0) return;
        try {
          const prods = window.api && typeof window.api.getProducts === 'function'
            ? await window.api.getProducts({})
            : (window.AppState && Array.isArray(window.AppState.products) ? window.AppState.products : []);
          if (Array.isArray(prods)) {
            this.barcodeState.products = prods.slice(0, 300);
            if (this.barcodeState.queue.length === 0 && prods.length > 0) {
              const first = prods[0];
              this.barcodeState.queue.push({
                id: first.id,
                name: first.name || 'منتج',
                barcode: first.barcode || '6130001000012',
                price: Number(first.selling_price ?? first.price ?? 0),
                qty: 4
              });
            }
          }
        } catch (_) {}
      },

      async loadPrintersIfAvailable() {
        if (this.availablePrinters.length > 0) return;
        try {
          if (window.api && typeof window.api.getPrinters === 'function') {
            const list = await window.api.getPrinters();
            if (Array.isArray(list)) this.availablePrinters = list;
          }
        } catch (_) {}
      },

      // تجهيز بيانات المعاينة بناءً على الوضع المختار (زبون عابر / زبون وفي / آخر فاتورة حقيقية)
      getPreviewDocDataFor(docId) {
        const meta = PSP.state.getDocMeta(docId);
        const mode = PSP.state.previewMode || 'VIP';
        const base = PSP.utils.deepClone(meta.sampleData || {});

        if (mode === 'WALKIN') {
          return {
            ...base,
            _previewMode: 'WALKIN',
            customerId: null,
            isWalkinCustomer: true,
            partyTitle: 'الزبون:',
            partyName: 'زبون عابر (Comptoir)',
            partyPhone: '',
            partyAddress: '',
            previousBalance: 0,
            loyaltyTotalBalance: 0,
            loyaltyPointsEarned: 0,
            loyaltyPointsUsed: 0,
            paidAmount: base.total || 0,
            receivedAmount: base.receivedAmount || base.total || 0,
            remainingDebt: 0
          };
        }

        if (mode === 'REAL_SALE' && this.realSaleDocCache) {
          return PSP.utils.deepClone(this.realSaleDocCache);
        }

        return {
          ...base,
          _previewMode: 'VIP'
        };
      },

      // ======================================================================
      // 2. بناء الشريط العلوي الرفيع الواحد (Single Minimal Top Bar ~54px)
      // ======================================================================
      buildTopbarHtml() {
        const view = PSP.state.activeView || 'gallery';

        if (view === 'studio') {
          const tpl = PSP.state.getActiveTemplate();
          const h = PSP.state.getHistoryInfo();
          const docs = PSP.state.getTemplatesRegistry();
          const cats = (PSP.categories || []).filter((c) => c.id !== 'ALL');

          const groupedOpts = cats.map((c) => {
            const inCat = docs.filter((d) => d.cat === c.id);
            const opts = inCat.map((d) => `<option value="${esc(d.id)}" ${d.id === tpl.id ? 'selected' : ''}>#${d.num} — ${esc(d.name)}</option>`).join('');
            return `<optgroup label="${esc(c.label)} (${inCat.length})">${opts}</optgroup>`;
          }).join('');

          const paperBtns = [
            ['80mm', '80mm'],
            ['58mm', '58mm'],
            ['a4', 'A4'],
            ['a5', 'A5'],
            ['2xa5', '2×A5']
          ].map(([val, lbl]) =>
            `<button type="button" class="psp-seg-btn ${tpl.paperSize === val ? 'is-active' : ''}" data-psp-act="set-paper" data-val="${val}">${lbl}</button>`
          ).join('');

          return `
            <div class="psp-topbar" id="pspTopbarHost">
              <div class="psp-topbar-group">
                <button type="button" class="psp-btn" data-psp-act="switch-view" data-val="gallery" title="العودة إلى معرض الـ 37 مستنداً">
                  <span class="material-symbols-rounded" style="font-size:17px;">arrow_forward</span>
                  <span>المعرض</span>
                </button>
                <button type="button" class="psp-btn psp-btn-icon" data-psp-act="prev-doc" title="المستند السابق">◀</button>
                <select class="psp-doc-select" data-psp-change="select-doc">${groupedOpts}</select>
                <button type="button" class="psp-btn psp-btn-icon" data-psp-act="next-doc" title="المستند التالي">▶</button>
              </div>

              <div class="psp-topbar-group">
                <div class="psp-segmented" title="مقاس الورقة السريع">${paperBtns}</div>

                <div class="psp-segmented" title="آلة الزمن لتعديلات القالب (Ctrl+Z / Ctrl+Y)">
                  <button type="button" id="pspUndoBtn" class="psp-seg-btn" data-psp-act="undo" ${!h.canUndo ? 'disabled' : ''}>⏪ تراجع</button>
                  <span id="pspHistCounter" style="font-family:monospace;font-size:10.5px;font-weight:900;padding:0 5px;color:var(--psp-text-muted);">${h.index + 1}/${h.total}</span>
                  <button type="button" id="pspRedoBtn" class="psp-seg-btn" data-psp-act="redo" ${!h.canRedo ? 'disabled' : ''}>إعادة ⏩</button>
                </div>
              </div>

              <div class="psp-topbar-group">
                <button type="button" class="psp-btn psp-btn-success" data-psp-act="save-template">
                  <span class="material-symbols-rounded" style="font-size:16px;">verified</span>
                  <span>حفظ واعتماد</span>
                </button>
                <button type="button" class="psp-btn psp-btn-primary" data-psp-act="print-current">
                  <span class="material-symbols-rounded" style="font-size:16px;">print</span>
                  <span>طباعة</span>
                </button>
                <button type="button" class="psp-btn" data-psp-act="pdf-current" title="تصدير PDF">PDF</button>
              </div>
            </div>`;
        }

        // الشريط العلوي الموحد للمعرض والباركود والمحرر الحر
        return `
          <div class="psp-topbar" id="pspTopbarHost">
            <div class="psp-topbar-group">
              <div class="psp-brand-pill">
                <span class="psp-brand-icon"><span class="material-symbols-rounded" style="font-size:18px;">print</span></span>
                <span>مركز الطباعة الشامل</span>
              </div>
              <div class="psp-segmented">
                <button type="button" class="psp-seg-btn ${view === 'gallery' ? 'is-active' : ''}" data-psp-act="switch-view" data-val="gallery">📚 معرض الـ 37 مستنداً</button>
                <button type="button" class="psp-seg-btn ${view === 'studio' ? 'is-active' : ''}" data-psp-act="switch-view" data-val="studio">🎨 المصمم البصري</button>
                <button type="button" class="psp-seg-btn ${view === 'barcodes' ? 'is-active' : ''}" data-psp-act="switch-view" data-val="barcodes">🏷️ الباركود والرفوف</button>
                <button type="button" class="psp-seg-btn ${view === 'word_editor' ? 'is-active' : ''}" data-psp-act="switch-view" data-val="word_editor">📝 محرر الوثائق الحر</button>
              </div>
            </div>

            <div class="psp-topbar-group">
              ${view === 'gallery' ? `<button type="button" class="psp-btn psp-btn-success" data-psp-act="reset-all-defaults">⚡ اعتماد الـ 34 الافتراضية (Par Défaut)</button>` : ''}
            </div>
          </div>`;
      },

      // ======================================================================
      // 3. الشاشة الأولى: معرض الـ 37 مستنداً (Zoho Books Style)
      // ======================================================================
      buildGalleryCardsHtml() {
        const docs = PSP.state.getTemplatesRegistry();
        const cat = this.galleryCategory || 'ALL';
        const q = (this.gallerySearch || '').trim().toLowerCase();

        const filtered = docs.filter((d) => {
          if (cat !== 'ALL' && d.cat !== cat) return false;
          if (q && !`${d.num} ${d.name} ${d.cleanTitle} ${d.sourceLabel} ${d.proDesc} ${d.id}`.toLowerCase().includes(q)) {
            return false;
          }
          return true;
        });

        if (filtered.length === 0) {
          return `<div style="grid-column:1/-1;text-align:center;padding:42px;color:var(--psp-text-muted);font-weight:800;font-size:13px;">لا توجد مستندات مطابقة للبحث "${esc(this.gallerySearch)}"</div>`;
        }

        return filtered.map((d) => {
          const tpl = PSP.state.getTemplate(d.id);
          const theme = PSP.state.THEMES[tpl.themeId] || PSP.state.THEMES.executive_dark;
          const paperLabel = String(tpl.paperSize || d.defaultPaper).toUpperCase();
          const activeSecCount = (tpl.sections || []).filter((s) => s.enabled).length;

          return `
            <div class="psp-doc-card">
              <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
                  <div style="min-width:0;flex:1;">
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                      <span class="psp-badge psp-badge-custom">#${d.num}</span>
                      <span class="psp-badge psp-badge-paper">${esc(paperLabel)}</span>
                      <span class="psp-badge ${tpl.isCustomized ? 'psp-badge-custom' : 'psp-badge-default'}">${tpl.isCustomized ? 'مخصص' : 'Par Défaut'}</span>
                    </div>
                    <div style="font-weight:900;font-size:13px;line-height:1.4;color:var(--psp-text);">${esc(d.name)}</div>
                  </div>
                  <div style="width:36px;height:42px;border-radius:8px;border:2px solid ${theme.primary};background:${theme.accentBg};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex-shrink:0;" title="${esc(theme.name)}">
                    <span style="width:20px;height:4px;border-radius:2px;background:${theme.primary};"></span>
                    <span style="width:16px;height:2px;border-radius:1px;background:#94a3b8;"></span>
                    <span style="width:20px;height:2px;border-radius:1px;background:#cbd5e1;"></span>
                  </div>
                </div>

                <div style="font-size:11px;color:var(--psp-text-muted);font-weight:700;line-height:1.5;">${esc(d.proDesc)}</div>

                <div style="display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:800;color:var(--psp-primary);background:var(--psp-surface-alt);padding:5px 8px;border-radius:8px;">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🔗 ${esc(d.sourceLabel)}</span>
                  <span style="color:var(--psp-text-muted);flex-shrink:0;">${activeSecCount} أقسام</span>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;padding-top:10px;border-top:1px solid var(--psp-border);">
                <button type="button" class="psp-btn psp-btn-primary" style="height:32px;font-size:11.5px;" data-psp-act="gallery-customize" data-doc="${esc(d.id)}">
                  🎨 تخصيص في الاستوديو
                </button>
                <button type="button" class="psp-btn" style="height:32px;padding:0 9px;font-size:11px;" data-psp-act="gallery-test-print" data-doc="${esc(d.id)}" title="طباعة تجريبية فورية">
                  🖨️ طباعة تجريبية
                </button>
                <button type="button" class="psp-btn" style="height:32px;padding:0 9px;font-size:11px;" data-psp-act="gallery-reset-doc" data-doc="${esc(d.id)}" title="استعادة القالب الافتراضي Par Défaut">
                  ↺
                </button>
              </div>
            </div>`;
        }).join('');
      },

      buildGalleryViewHtml() {
        const cats = PSP.categories || [{ id: 'ALL', label: 'كل المستندات', count: 34 }];
        const catPills = cats.map((c) =>
          `<button type="button" class="psp-cat-pill ${this.galleryCategory === c.id ? 'is-active' : ''}" data-psp-act="gallery-cat" data-val="${esc(c.id)}">${esc(c.label)} (${c.count})</button>`
        ).join('');

        return `
          <div class="psp-gallery-shell">
            <div class="psp-gallery-toolbar">
              <div class="psp-cat-pills" id="pspGalleryCatsHost">${catPills}</div>
              <input type="text" id="pspGallerySearchInp" class="psp-search-input" value="${esc(this.gallerySearch)}" data-psp-input="gallery-search" placeholder="🔎 ابحث في الـ 37 مستنداً (كريدي، Z-Report، F8، فاتورة...)">
            </div>
            <div class="psp-gallery-grid" id="pspGalleryGridHost">
              ${this.buildGalleryCardsHtml()}
            </div>
          </div>`;
      },

      // ======================================================================
      // 4. الشاشة الثانية: المصمم البصري (4 تبويبات جانبية + منصة حية + شريط عائم)
      // ======================================================================
      buildSidebarBodyHtml() {
        const tab = PSP.state.activeSidebarTab || 'identity';
        const tpl = PSP.state.getActiveTemplate();
        const meta = PSP.state.getDocMeta(tpl.id);
        const shop = PSP.state.getShopIdentity();

        // ── تبويب 1: الهوية والمظهر ──
        if (tab === 'identity') {
          const swatches = Object.values(PSP.state.THEMES).map((th) =>
            `<button type="button" class="psp-swatch ${tpl.themeId === th.id ? 'is-active' : ''}" style="background:${th.primary};" data-psp-act="set-theme" data-val="${esc(th.id)}" title="${esc(th.name)}"></button>`
          ).join('');

          return `
            <div class="psp-card">
              <div class="psp-card-title"><span>🎨 الثيم اللوني والخط</span><span style="font-size:10.5px;color:var(--psp-text-muted);">${esc((PSP.state.THEMES[tpl.themeId] || {}).name || '')}</span></div>
              <div class="psp-swatch-grid">${swatches}</div>
              <div class="psp-grid-2">
                <div class="psp-field">
                  <label>نوع الخط</label>
                  <select class="psp-select" data-psp-change="tpl-field" data-field="fontFamily">
                    <option value="Cairo" ${tpl.fontFamily === 'Cairo' ? 'selected' : ''}>Cairo (قياسي)</option>
                    <option value="Tajawal" ${tpl.fontFamily === 'Tajawal' ? 'selected' : ''}>Tajawal (عصري)</option>
                    <option value="Tahoma" ${tpl.fontFamily === 'Tahoma' ? 'selected' : ''}>Tahoma (حراري واضح)</option>
                  </select>
                </div>
                <div class="psp-field">
                  <label>حجم الخط (<span id="pspFontValLbl">${tpl.baseFontSizePx}px</span>)</label>
                  <div class="psp-pill-row">
                    <button type="button" class="psp-pill-btn" data-psp-act="font-dec">A-</button>
                    <button type="button" class="psp-pill-btn" data-psp-act="font-inc">A+</button>
                  </div>
                </div>
              </div>
              <div class="psp-field">
                <label>كثافة السطور (توفير الورق الحراري)</label>
                <div class="psp-pill-row">
                  <button type="button" class="psp-pill-btn ${tpl.densityMode === 'compact' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="densityMode" data-val="compact">مضغوط</button>
                  <button type="button" class="psp-pill-btn ${tpl.densityMode === 'normal' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="densityMode" data-val="normal">متوازن</button>
                  <button type="button" class="psp-pill-btn ${tpl.densityMode === 'spacious' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="densityMode" data-val="spacious">مريح</button>
                </div>
              </div>
              <div class="psp-grid-2">
                <div class="psp-field">
                  <label>الهوامش</label>
                  <div class="psp-pill-row">
                    <button type="button" class="psp-pill-btn ${tpl.marginMode === 'compact' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="marginMode" data-val="compact">ضيق</button>
                    <button type="button" class="psp-pill-btn ${tpl.marginMode === 'normal' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="marginMode" data-val="normal">عادي</button>
                    <button type="button" class="psp-pill-btn ${tpl.marginMode === 'wide' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="marginMode" data-val="wide">واسع</button>
                  </div>
                </div>
                <div class="psp-field">
                  <label>حدود الجدول</label>
                  <div class="psp-pill-row">
                    <button type="button" class="psp-pill-btn ${tpl.borderMode === 'dashed' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="borderMode" data-val="dashed">متقطع</button>
                    <button type="button" class="psp-pill-btn ${tpl.borderMode === 'grid' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="borderMode" data-val="grid">شبكة</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="psp-card">
              <div style="margin-bottom:4px;">
                <button type="button" class="psp-btn psp-btn-primary" style="width:100%;height:32px;font-size:11px;" data-psp-act="apply-style-all">
                  🌐 تعميم هذا المظهر والخط والمقاس الحراري على كل الـ 37 مستنداً
                </button>
              </div>
              <div class="psp-card-title"><span>🖼️ الشعار وعنوان المستند</span></div>
              <div class="psp-grid-2">
                <div class="psp-field">
                  <label>حجم الشعار (${tpl.logoSizePx || 42}px)</label>
                  <input type="range" min="24" max="80" value="${Number(tpl.logoSizePx || 42)}" data-psp-input="tpl-num" data-field="logoSizePx">
                </div>
                <div class="psp-field">
                  <label>موضع الشعار</label>
                  <div class="psp-pill-row">
                    <button type="button" class="psp-pill-btn ${tpl.logoAlign === 'right' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="logoAlign" data-val="right">يمين</button>
                    <button type="button" class="psp-pill-btn ${tpl.logoAlign === 'center' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="logoAlign" data-val="center">وسط</button>
                    <button type="button" class="psp-pill-btn ${tpl.logoAlign === 'left' ? 'is-active' : ''}" data-psp-act="tpl-pill" data-field="logoAlign" data-val="left">يسار</button>
                  </div>
                </div>
              </div>
              <div class="psp-field">
                <label>عنوان المستند الظاهر</label>
                <input type="text" class="psp-input" value="${esc(tpl.customTitle || '')}" data-psp-input="tpl-field" data-field="customTitle">
              </div>
              <div class="psp-field">
                <label>عبارة التذييل وشروط الاستبدال</label>
                <input type="text" class="psp-input" value="${esc(tpl.footerText || '')}" data-psp-input="tpl-field" data-field="footerText">
              </div>
            </div>

            <div class="psp-card">
              <div class="psp-card-title"><span>🏢 بيانات المتجر والبيانات الجبائية</span></div>
              <div class="psp-field"><label>اسم المتجر / المؤسسة</label><input type="text" class="psp-input" value="${esc(shop.name)}" data-psp-input="shop-field" data-field="shop_name"></div>
              <div class="psp-grid-2">
                <div class="psp-field"><label>الهاتف</label><input type="text" class="psp-input" dir="ltr" value="${esc(shop.phone)}" data-psp-input="shop-field" data-field="shop_phone"></div>
                <div class="psp-field"><label>العنوان</label><input type="text" class="psp-input" value="${esc(shop.address)}" data-psp-input="shop-field" data-field="shop_address"></div>
                <div class="psp-field"><label>RC</label><input type="text" class="psp-input" dir="ltr" value="${esc(shop.rc)}" data-psp-input="shop-field" data-field="shop_rc"></div>
                <div class="psp-field"><label>NIF</label><input type="text" class="psp-input" dir="ltr" value="${esc(shop.nif)}" data-psp-input="shop-field" data-field="shop_nif"></div>
                <div class="psp-field"><label>AI</label><input type="text" class="psp-input" dir="ltr" value="${esc(shop.ai)}" data-psp-input="shop-field" data-field="shop_ai"></div>
                <div class="psp-field"><label>NIS</label><input type="text" class="psp-input" dir="ltr" value="${esc(shop.nis)}" data-psp-input="shop-field" data-field="shop_nis"></div>
              </div>
              <div class="psp-field"><label>BaridiMob RIP</label><input type="text" class="psp-input" dir="ltr" value="${esc(shop.rip)}" data-psp-input="shop-field" data-field="shop_baridimob_rip"></div>
            </div>`;
        }

        // ── تبويب 2: مكونات المستند (Progressive Disclosure) ──
        if (tab === 'sections') {
          const recommendedSet = new Set(meta.defaultSections || []);
          const allSecs = tpl.sections || [];
          const primarySecs = allSecs.filter((s) => s.enabled || recommendedSet.has(s.id));
          const optionalSecs = allSecs.filter((s) => !s.enabled && !recommendedSet.has(s.id));

          const renderSecRow = (sec) => {
            const realIdx = allSecs.findIndex((x) => x.id === sec.id);
            const isExp = this.expandedSectionId === sec.id;
            const catInfo = PSP.state.SECTIONS_CATALOG.find((c) => c.id === sec.id);
            return `
              <div class="psp-sec-row ${sec.enabled ? 'is-enabled' : ''} ${isExp ? 'is-expanded' : ''}">
                <div class="psp-sec-head">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;flex:1;">
                    <label class="psp-switch">
                      <input type="checkbox" ${sec.enabled ? 'checked' : ''} data-psp-change="toggle-section" data-sec="${esc(sec.id)}">
                      <span class="psp-switch-track"></span>
                    </label>
                    <div style="min-width:0;flex:1;cursor:pointer;" data-psp-act="expand-section" data-sec="${esc(sec.id)}">
                      <div style="font-size:11.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(catInfo ? catInfo.name : sec.label)}</div>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:3px;flex-shrink:0;">
                    <button type="button" class="psp-mini-btn ${isExp ? 'is-active' : ''}" data-psp-act="expand-section" data-sec="${esc(sec.id)}" title="خصائص القسم">⚙️</button>
                    <button type="button" class="psp-mini-btn" data-psp-act="move-sec-up" data-sec="${esc(sec.id)}" ${realIdx <= 0 ? 'disabled' : ''} title="تحريك لأعلى">▲</button>
                    <button type="button" class="psp-mini-btn" data-psp-act="move-sec-down" data-sec="${esc(sec.id)}" ${realIdx >= allSecs.length - 1 ? 'disabled' : ''} title="تحريك لأسفل">▼</button>
                  </div>
                </div>
                ${isExp ? `
                  <div class="psp-sec-drawer">
                    <div style="font-size:10.5px;color:var(--psp-text-muted);font-weight:700;">${esc(catInfo ? catInfo.desc : '')}</div>
                    <div class="psp-field">
                      <label>عنوان مخصص (اختياري)</label>
                      <input type="text" class="psp-input" value="${esc(sec.title || '')}" placeholder="اتركه فارغاً للعنوان الافتراضي" data-psp-input="sec-field" data-sec="${esc(sec.id)}" data-field="title">
                    </div>
                    <div class="psp-field">
                      <label>ملاحظة أسفل القسم</label>
                      <input type="text" class="psp-input" value="${esc(sec.note || '')}" placeholder="أضف نصاً أو متغيراً..." data-psp-input="sec-field" data-sec="${esc(sec.id)}" data-field="note">
                      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
                        <button type="button" class="psp-var-chip" data-psp-act="insert-var" data-sec="${esc(sec.id)}" data-val="{اسم_المتجر}">+ المتجر</button>
                        <button type="button" class="psp-var-chip" data-psp-act="insert-var" data-sec="${esc(sec.id)}" data-val="{هاتف_المتجر}">+ الهاتف</button>
                        <button type="button" class="psp-var-chip" data-psp-act="insert-var" data-sec="${esc(sec.id)}" data-val="{الإجمالي_بالسنتيم}">+ السنتيم</button>
                        <button type="button" class="psp-var-chip" data-psp-act="insert-var" data-sec="${esc(sec.id)}" data-val="{إجمالي_ديون_الزبون}">+ الديون</button>
                      </div>
                    </div>
                    <div class="psp-grid-2">
                      <div class="psp-field">
                        <label>المحاذاة</label>
                        <div class="psp-pill-row">
                          <button type="button" class="psp-pill-btn ${sec.align === 'right' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="align" data-val="right">يمين</button>
                          <button type="button" class="psp-pill-btn ${sec.align === 'center' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="align" data-val="center">وسط</button>
                          <button type="button" class="psp-pill-btn ${sec.align === 'left' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="align" data-val="left">يسار</button>
                        </div>
                      </div>
                      <div class="psp-field">
                        <label>حجم الخط (${sec.fontScale || 100}%)</label>
                        <div class="psp-pill-row">
                          ${[90, 100, 115].map((s) => `<button type="button" class="psp-pill-btn ${Number(sec.fontScale || 100) === s ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="fontScale" data-val="${s}">${s}%</button>`).join('')}
                        </div>
                      </div>
                    </div>
                    <div class="psp-grid-2">
                      <div class="psp-field">
                        <label>إطار القسم</label>
                        <div class="psp-pill-row">
                          <button type="button" class="psp-pill-btn ${sec.border === 'default' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="border" data-val="default">عادي</button>
                          <button type="button" class="psp-pill-btn ${sec.border === 'solid' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="border" data-val="solid">بارز</button>
                          <button type="button" class="psp-pill-btn ${sec.border === 'dashed' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="border" data-val="dashed">متقطع</button>
                        </div>
                      </div>
                      <div class="psp-field">
                        <label>الخلفية</label>
                        <div class="psp-pill-row">
                          <button type="button" class="psp-pill-btn ${sec.bg === 'default' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="bg" data-val="default">عادي</button>
                          <button type="button" class="psp-pill-btn ${sec.bg === 'tinted' ? 'is-active' : ''}" data-psp-act="sec-pill" data-sec="${esc(sec.id)}" data-field="bg" data-val="tinted">ملون</button>
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;">
                      <button type="button" class="psp-mini-btn" data-psp-act="reset-sec" data-sec="${esc(sec.id)}">↺ ضبط هذا القسم</button>
                    </div>
                  </div>` : ''}
              </div>`;
          };

          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:0 2px;">
              <span style="font-size:11.5px;font-weight:900;">مكونات هذا المستند (${primarySecs.filter((s) => s.enabled).length} مفعّل)</span>
              <button type="button" class="psp-mini-btn" data-psp-act="toggle-optional-secs">
                ${this.showOptionalSections ? 'إخفاء الإضافية ▲' : `+ إضافة قسم إضافي (${optionalSecs.length})`}
              </button>
            </div>
            ${primarySecs.map(renderSecRow).join('')}
            ${this.showOptionalSections && optionalSecs.length > 0 ? `
              <div style="margin-top:6px;padding-top:8px;border-top:1px dashed var(--psp-border-strong);font-size:11px;font-weight:900;color:var(--psp-text-muted);">
                أقسام إضافية اختيارية (فعّل ما تحتاجه):
              </div>
              ${optionalSecs.map(renderSecRow).join('')}
            ` : ''}`;
        }

        // ── تبويب 3: أعمدة الجدول ──
        if (tab === 'columns') {
          const cols = tpl.columns || {};
          const lang = tpl.lang || 'ar';
          const defLbls = PSP.state.DEFAULT_COLUMN_LABELS[lang] || PSP.state.DEFAULT_COLUMN_LABELS.ar;
          const lbls = { ...defLbls, ...(tpl.columnLabels || {}) };

          const colItems = [
            ['index', 'رقم السطر (#)'],
            ['barcode', 'الباركود / الكود'],
            ['name', 'التعيين / الصنف'],
            ['unit', 'الوحدة / الحالة'],
            ['qty', 'الكمية'],
            ['unitPrice', 'سعر الوحدة'],
            ['discount', 'الخصم'],
            ['tva', 'ضريبة TVA'],
            ['subtotal', 'المجموع']
          ];

          return `
            <div class="psp-card">
              <div class="psp-card-title"><span>⚡ قوالب أعمدة جاهزة بضغطة زر</span></div>
              <div class="psp-grid-2">
                <button type="button" class="psp-btn" style="height:30px;font-size:11px;" data-psp-act="col-preset" data-val="thermal_simple">🧾 تذكرة 80mm</button>
                <button type="button" class="psp-btn" style="height:30px;font-size:11px;" data-psp-act="col-preset" data-val="alt_d_credit">📝 تأكيد دين Alt+D</button>
                <button type="button" class="psp-btn" style="height:30px;font-size:11px;" data-psp-act="col-preset" data-val="a4_full">📄 فاتورة A4 كاملة</button>
                <button type="button" class="psp-btn" style="height:30px;font-size:11px;" data-psp-act="col-preset" data-val="bl_qty_only">🚚 وصل كميات BL</button>
                <button type="button" class="psp-btn" style="height:30px;font-size:11px;" data-psp-act="col-preset" data-val="z_report">🔒 وردية Z-Report</button>
                <button type="button" class="psp-btn" style="height:30px;font-size:11px;" data-psp-act="col-preset" data-val="alt_h_history">📜 هيستوريك Alt+H</button>
              </div>
            </div>

            <div class="psp-card">
              <div class="psp-card-title"><span>📊 إظهار الأعمدة وتعديل مسمياتها</span></div>
              ${colItems.map(([key, arTitle]) => `
                <div class="psp-col-row">
                  <div style="display:flex;align-items:center;gap:8px;min-width:110px;">
                    <label class="psp-switch">
                      <input type="checkbox" ${cols[key] ? 'checked' : ''} data-psp-change="toggle-col" data-col="${key}">
                      <span class="psp-switch-track"></span>
                    </label>
                    <span style="font-size:11px;font-weight:800;">${arTitle}</span>
                  </div>
                  <input type="text" class="psp-input" style="height:28px;font-size:11px;max-width:135px;" value="${esc(lbls[key] || '')}" data-psp-input="col-label" data-col="${key}">
                </div>`).join('')}
            </div>`;
        }

        // ── تبويب 4: الطابعة واللغة ──
        const printerOpts = [
          `<option value="">الطابعة الافتراضية للنظام</option>`,
          ...this.availablePrinters.map((p) => {
            const pName = typeof p === 'string' ? p : (p.name || p.displayName || '');
            return `<option value="${esc(pName)}" ${tpl.printerName === pName ? 'selected' : ''}>🖨️ ${esc(pName)}</option>`;
          })
        ].join('');

        return `
          <div class="psp-card">
            <div class="psp-card-title"><span>🌐 لغة المستند والمقاس</span></div>
            <div class="psp-field">
              <label>لغة التسميات واتجاه المستند</label>
              <div class="psp-pill-row">
                <button type="button" class="psp-pill-btn ${tpl.lang === 'ar' ? 'is-active' : ''}" data-psp-act="set-lang" data-val="ar">🇩🇿 العربية</button>
                <button type="button" class="psp-pill-btn ${tpl.lang === 'fr' ? 'is-active' : ''}" data-psp-act="set-lang" data-val="fr">🇫🇷 Français</button>
                <button type="button" class="psp-pill-btn ${tpl.lang === 'en' ? 'is-active' : ''}" data-psp-act="set-lang" data-val="en">🇬🇧 English</button>
              </div>
            </div>
            <div class="psp-grid-2">
              <div class="psp-field">
                <label>عدد النسخ</label>
                <input type="number" min="1" max="5" class="psp-input" value="${Number(tpl.copies || 1)}" data-psp-input="tpl-num" data-field="copies">
              </div>
              <div class="psp-field">
                <label>الطابعة المرتبطة</label>
                <select class="psp-select" data-psp-change="tpl-field" data-field="printerName">${printerOpts}</select>
              </div>
            </div>
          </div>

          <div class="psp-card">
            <div class="psp-card-title"><span>🇩🇿 الخيارات المحاسبية الجزائرية</span></div>
            <div class="psp-col-row">
              <span style="font-size:11.5px;font-weight:800;">إظهار المكافئ بالسنتيم الجزائري</span>
              <label class="psp-switch"><input type="checkbox" ${tpl.showCentimes ? 'checked' : ''} data-psp-change="tpl-bool" data-field="showCentimes"><span class="psp-switch-track"></span></label>
            </div>
            <div class="psp-col-row">
              <span style="font-size:11.5px;font-weight:800;">التفقيط بالحروف (Arrêté à la somme)</span>
              <label class="psp-switch"><input type="checkbox" ${tpl.showAmountInWords ? 'checked' : ''} data-psp-change="tpl-bool" data-field="showAmountInWords"><span class="psp-switch-track"></span></label>
            </div>
            <div class="psp-col-row">
              <span style="font-size:11.5px;font-weight:800;">إظهار البيانات الجبائية (RC/NIF/AI/NIS)</span>
              <label class="psp-switch"><input type="checkbox" ${tpl.showFiscalIds ? 'checked' : ''} data-psp-change="tpl-bool" data-field="showFiscalIds"><span class="psp-switch-track"></span></label>
            </div>
            <div class="psp-col-row">
              <span style="font-size:11.5px;font-weight:800;">إظهار حساب BaridiMob RIP في التذييل</span>
              <label class="psp-switch"><input type="checkbox" ${tpl.showRipFooter ? 'checked' : ''} data-psp-change="tpl-bool" data-field="showRipFooter"><span class="psp-switch-track"></span></label>
            </div>
          </div>

          <div class="psp-card">
            <div class="psp-card-title"><span>↺ إعادة ضبط القالب</span></div>
            <p style="margin:0;font-size:11px;color:var(--psp-text-muted);font-weight:700;">يعيد هذا القالب فقط إلى تصميمه الافتراضي المثالي (Par Défaut) دون التأثير على باقي الـ 33 مستنداً.</p>
            <button type="button" class="psp-btn" style="color:var(--psp-danger);border-color:rgba(220,38,38,0.35);" data-psp-act="reset-active-doc">↺ استعادة القالب الافتراضي (Par Défaut)</button>
          </div>`;
      },

      buildStudioViewHtml() {
        const tpl = PSP.state.getActiveTemplate();
        const tab = PSP.state.activeSidebarTab || 'identity';
        const pMode = PSP.state.previewMode || 'VIP';
        const zoom = Number(PSP.state.zoomPct || 100);
        const docData = this.getPreviewDocDataFor(tpl.id);
        const rendered = PSP.renderer.renderDocument(tpl, docData, 'preview', { zoomPct: zoom });

        const realBadge = this.realSalesList.length > 0
          ? `#${this.realSalesList[this.realSaleIndex]?.doc_number || this.realSalesList[this.realSaleIndex]?.id}`
          : 'حقيقية';

        return `
          <div class="psp-studio-shell">
            <!-- اللوحة الجانبية ذات الـ 4 تبويبات أيقونية -->
            <aside class="psp-sidebar">
              <div class="psp-sidebar-tabs" id="pspSideTabsHost">
                <button type="button" class="psp-side-tab ${tab === 'identity' ? 'is-active' : ''}" data-psp-act="side-tab" data-val="identity">
                  <span style="font-size:16px;">🎨</span><span>الهوية</span>
                </button>
                <button type="button" class="psp-side-tab ${tab === 'sections' ? 'is-active' : ''}" data-psp-act="side-tab" data-val="sections">
                  <span style="font-size:16px;">🧩</span><span>المكونات</span>
                </button>
                <button type="button" class="psp-side-tab ${tab === 'columns' ? 'is-active' : ''}" data-psp-act="side-tab" data-val="columns">
                  <span style="font-size:16px;">📊</span><span>الأعمدة</span>
                </button>
                <button type="button" class="psp-side-tab ${tab === 'printer' ? 'is-active' : ''}" data-psp-act="side-tab" data-val="printer">
                  <span style="font-size:16px;">🖨️</span><span>الطابعة</span>
                </button>
              </div>
              <div class="psp-sidebar-body" id="pspSidebarBodyHost">
                ${this.buildSidebarBodyHtml()}
              </div>
            </aside>

            <!-- منصة المعاينة الحية المركزية + الشريط السفلي العائم -->
            <div class="psp-desk-wrap">
              <div class="psp-desk-scroll" id="pspPaperHost">
                ${rendered.paperHtml}
              </div>

              <div class="psp-floating-bar" id="pspFloatingBarHost">
                <button type="button" class="psp-float-btn ${pMode === 'WALKIN' ? 'is-active' : ''}" data-psp-act="set-preview-mode" data-val="WALKIN">🚶 زبون عابر</button>
                <button type="button" class="psp-float-btn ${pMode === 'VIP' ? 'is-active' : ''}" data-psp-act="set-preview-mode" data-val="VIP">👑 زبون وفي</button>
                <button type="button" class="psp-float-btn ${pMode === 'REAL_SALE' ? 'is-active' : ''}" data-psp-act="set-preview-mode" data-val="REAL_SALE">🆕 آخر فاتورة ${pMode === 'REAL_SALE' ? `(${esc(realBadge)})` : ''}</button>
                ${pMode === 'REAL_SALE' && this.realSalesList.length > 1 ? `
                  <button type="button" class="psp-float-btn" style="padding:0 6px;" data-psp-act="real-sale-step" data-val="1" title="الأقدم">◀</button>
                  <button type="button" class="psp-float-btn" style="padding:0 6px;" data-psp-act="real-sale-step" data-val="-1" title="الأحدث">▶</button>
                ` : ''}
                <span class="psp-float-sep"></span>
                <button type="button" class="psp-float-btn ${zoom === 75 ? 'is-active' : ''}" data-psp-act="set-zoom" data-val="75">75%</button>
                <button type="button" class="psp-float-btn ${zoom === 100 ? 'is-active' : ''}" data-psp-act="set-zoom" data-val="100">100%</button>
                <button type="button" class="psp-float-btn ${zoom === 125 ? 'is-active' : ''}" data-psp-act="set-zoom" data-val="125">125%</button>
              </div>
            </div>
          </div>`;
      },

      // ======================================================================
      // 5. الشاشة الثالثة: استوديو ملصقات الباركود والرفوف
      // ======================================================================
      buildBarcodePreviewHtml() {
        const bs = this.barcodeState;
        const shop = PSP.state.getShopIdentity();
        const dimMap = {
          '40x25': { w: '40mm', h: '25mm', barH: 26, font: '9px', priceFont: '11px' },
          '50x30': { w: '50mm', h: '30mm', barH: 32, font: '10px', priceFont: '13px' },
          '60x40': { w: '60mm', h: '40mm', barH: 38, font: '11px', priceFont: '15px' },
          'a4':    { w: '48mm', h: '28mm', barH: 28, font: '9.5px', priceFont: '12px' }
        };
        const d = dimMap[bs.size] || dimMap['40x25'];
        const labels = [];

        for (const item of bs.queue) {
          const count = Math.min(60, Math.max(1, Number(item.qty || 1)));
          for (let i = 0; i < count; i++) {
            labels.push(`
              <div class="psp-barcode-card" style="width:${d.w};min-height:${d.h};font-size:${d.font};">
                ${bs.showShop ? `<div style="font-weight:900;font-size:8.5px;color:#334155;">${esc(shop.name)}</div>` : ''}
                ${bs.showName ? `<div style="font-weight:900;line-height:1.2;max-height:2.4em;overflow:hidden;">${esc(item.name)}</div>` : ''}
                ${buildBarcodeSvg(item.barcode, d.barH)}
                ${bs.showCodeText ? `<div style="font-family:monospace;font-size:8.5px;letter-spacing:1px;font-weight:800;">${esc(item.barcode)}</div>` : ''}
                ${bs.showPrice ? `<div style="font-family:monospace;font-weight:900;font-size:${d.priceFont};color:#0f172a;">${Number(item.price || 0).toFixed(2)} د.ج${bs.showCentimes ? ` <span style="font-size:8px;color:#475569;">(${fmtCentimes(item.price)})</span>` : ''}</div>` : ''}
              </div>`);
          }
        }

        if (labels.length === 0) {
          return `<div style="color:var(--psp-text-muted);font-weight:800;padding:40px;text-align:center;">أضف منتجات من القائمة اليمنى لمعاينة وطباعة الملصقات</div>`;
        }
        return `<div class="psp-barcode-sheet">${labels.join('')}</div>`;
      },

      buildBarcodesViewHtml() {
        const bs = this.barcodeState;
        const q = (bs.search || '').trim().toLowerCase();
        const filteredProds = bs.products
          .filter((p) => !q || `${p.name || ''} ${p.barcode || ''}`.toLowerCase().includes(q))
          .slice(0, 25);

        return `
          <div class="psp-sub-workspace">
            <aside class="psp-sidebar">
              <div class="psp-sidebar-body">
                <div class="psp-card">
                  <div class="psp-card-title"><span>📐 مقاس ومحتوى الملصق</span></div>
                  <div class="psp-pill-row">
                    <button type="button" class="psp-pill-btn ${bs.size === '40x25' ? 'is-active' : ''}" data-psp-act="bc-size" data-val="40x25">40×25</button>
                    <button type="button" class="psp-pill-btn ${bs.size === '50x30' ? 'is-active' : ''}" data-psp-act="bc-size" data-val="50x30">50×30</button>
                    <button type="button" class="psp-pill-btn ${bs.size === '60x40' ? 'is-active' : ''}" data-psp-act="bc-size" data-val="60x40">60×40</button>
                    <button type="button" class="psp-pill-btn ${bs.size === 'a4' ? 'is-active' : ''}" data-psp-act="bc-size" data-val="a4">ورقة A4</button>
                  </div>
                  <div class="psp-grid-2" style="font-size:11px;font-weight:800;">
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" ${bs.showShop ? 'checked' : ''} data-psp-change="bc-opt" data-field="showShop"> اسم المتجر</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" ${bs.showName ? 'checked' : ''} data-psp-change="bc-opt" data-field="showName"> اسم المنتج</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" ${bs.showPrice ? 'checked' : ''} data-psp-change="bc-opt" data-field="showPrice"> السعر</label>
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" ${bs.showCentimes ? 'checked' : ''} data-psp-change="bc-opt" data-field="showCentimes"> السنتيم</label>
                  </div>
                </div>

                <div class="psp-card">
                  <div class="psp-card-title"><span>🔍 إضافة منتجات للطابور</span></div>
                  <input type="text" class="psp-input" value="${esc(bs.search)}" placeholder="ابحث بالاسم أو الباركود..." data-psp-input="bc-search">
                  <div style="max-height:175px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;">
                    ${filteredProds.map((p) => `
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 8px;background:var(--psp-surface);border:1px solid var(--psp-border);border-radius:8px;font-size:11px;">
                        <div style="min-width:0;flex:1;">
                          <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
                          <div style="font-family:monospace;font-size:10px;color:var(--psp-text-muted);">${esc(p.barcode || '-')} • ${Number(p.selling_price ?? p.price ?? 0).toFixed(2)} د.ج</div>
                        </div>
                        <button type="button" class="psp-mini-btn is-active" data-psp-act="bc-add" data-id="${p.id}">+ إضافة</button>
                      </div>`).join('')}
                  </div>
                </div>

                <div class="psp-card">
                  <div class="psp-card-title">
                    <span>🖨️ طابور الطباعة (${bs.queue.reduce((s, x) => s + Number(x.qty || 1), 0)} ملصق)</span>
                    ${bs.queue.length > 0 ? `<button type="button" class="psp-mini-btn" data-psp-act="bc-clear">تفريغ</button>` : ''}
                  </div>
                  <div style="display:flex;flex-direction:column;gap:5px;max-height:150px;overflow-y:auto;">
                    ${bs.queue.map((qItem, idx) => `
                      <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 8px;background:var(--psp-surface);border:1px solid var(--psp-border);border-radius:8px;font-size:11px;">
                        <span style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${esc(qItem.name)}</span>
                        <input type="number" min="1" max="100" value="${qItem.qty}" style="width:48px;height:26px;text-align:center;" class="psp-input" data-psp-input="bc-qty" data-idx="${idx}">
                        <button type="button" class="psp-mini-btn" data-psp-act="bc-remove" data-idx="${idx}">✕</button>
                      </div>`).join('') || '<div style="font-size:11px;color:var(--psp-text-muted);text-align:center;">الطابور فارغ</div>'}
                  </div>
                  <div class="psp-grid-2" style="margin-top:4px;">
                    <button type="button" class="psp-btn psp-btn-primary" data-psp-act="bc-print">🖨️ طباعة الملصقات</button>
                    <button type="button" class="psp-btn" data-psp-act="bc-pdf">📄 تصدير PDF</button>
                  </div>
                </div>
              </div>
            </aside>

            <div class="psp-desk-wrap">
              <div class="psp-desk-scroll" id="pspBarcodeDeskHost">
                ${this.buildBarcodePreviewHtml()}
              </div>
            </div>
          </div>`;
      },

      // ======================================================================
      // 6. الشاشة الرابعة: محرر الوثائق والبونات الحر (Word)
      // ======================================================================
      buildWordEditorViewHtml() {
        const ws = this.wordState;
        const shop = PSP.state.getShopIdentity();
        const widthCss = ws.paperSize === '80mm' ? '80mm' : ws.paperSize === 'a5' ? '148mm' : '210mm';

        return `
          <div class="psp-sub-workspace">
            <aside class="psp-sidebar">
              <div class="psp-sidebar-body">
                <div class="psp-card">
                  <div class="psp-card-title"><span>📐 إعدادات الوثيقة الحرة</span></div>
                  <div class="psp-pill-row">
                    <button type="button" class="psp-pill-btn ${ws.paperSize === 'a4' ? 'is-active' : ''}" data-psp-act="word-size" data-val="a4">A4</button>
                    <button type="button" class="psp-pill-btn ${ws.paperSize === 'a5' ? 'is-active' : ''}" data-psp-act="word-size" data-val="a5">A5</button>
                    <button type="button" class="psp-pill-btn ${ws.paperSize === '80mm' ? 'is-active' : ''}" data-psp-act="word-size" data-val="80mm">80mm</button>
                  </div>
                  <div class="psp-col-row">
                    <span style="font-size:11.5px;font-weight:800;">إدراج ترويسة المتجر الرسمية</span>
                    <label class="psp-switch"><input type="checkbox" ${ws.includeShopHeader ? 'checked' : ''} data-psp-change="word-header"><span class="psp-switch-track"></span></label>
                  </div>
                </div>

                <div class="psp-card">
                  <div class="psp-card-title"><span>✍️ أدوات التنسيق</span></div>
                  <div style="display:flex;flex-wrap:wrap;gap:5px;">
                    <button type="button" class="psp-btn" style="height:30px;padding:0 10px;" data-psp-act="word-cmd" data-val="bold"><b>B</b> عريض</button>
                    <button type="button" class="psp-btn" style="height:30px;padding:0 10px;" data-psp-act="word-cmd" data-val="underline"><u>U</u> تسطير</button>
                    <button type="button" class="psp-btn" style="height:30px;padding:0 10px;" data-psp-act="word-cmd" data-val="justifyRight">يمين</button>
                    <button type="button" class="psp-btn" style="height:30px;padding:0 10px;" data-psp-act="word-cmd" data-val="justifyCenter">وسط</button>
                    <button type="button" class="psp-btn" style="height:30px;padding:0 10px;" data-psp-act="word-cmd" data-val="insertUnorderedList">• قائمة</button>
                  </div>
                </div>

                <div class="psp-card">
                  <div class="psp-card-title"><span>📋 نماذج جاهزة بضغطة زر</span></div>
                  <button type="button" class="psp-btn" style="justify-content:flex-start;" data-psp-act="word-preset" data-val="promo">📢 إعلان تخفيضات للزبائن</button>
                  <button type="button" class="psp-btn" style="justify-content:flex-start;" data-psp-act="word-preset" data-val="debt_ack">📝 التزام واعتراف بدين</button>
                  <button type="button" class="psp-btn" style="justify-content:flex-start;" data-psp-act="word-preset" data-val="receipt_free">💵 وصل استلام مبلغ حر</button>
                </div>

                <div class="psp-grid-2">
                  <button type="button" class="psp-btn psp-btn-primary" data-psp-act="word-print">🖨️ طباعة الآن</button>
                  <button type="button" class="psp-btn" data-psp-act="word-pdf">📄 تصدير PDF</button>
                </div>
              </div>
            </aside>

            <div class="psp-desk-wrap">
              <div class="psp-desk-scroll">
                <div style="width:${widthCss};max-width:100%;background:#ffffff;color:#0f172a;box-shadow:var(--psp-shadow-paper);padding:${ws.paperSize === '80mm' ? '4mm' : '12mm'};direction:rtl;" id="pspWordPrintablePaper">
                  ${ws.includeShopHeader ? `
                    <div style="text-align:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:14px;">
                      <div style="font-size:18px;font-weight:900;">${esc(shop.name)}</div>
                      <div style="font-size:11px;color:#475569;font-weight:700;">${esc(shop.address)}${shop.phone ? ` | ${esc(shop.phone)}` : ''}</div>
                    </div>` : ''}
                  <div id="pspWordEditableArea" contenteditable="true" spellcheck="false" style="min-height:140mm;outline:none;line-height:1.75;font-size:13px;">${ws.htmlBody}</div>
                </div>
              </div>
            </div>
          </div>`;
      },

      // ======================================================================
      // 7. التحديث الجراحي اللحظي (<16ms — بدون إعادة رسم الصفحة أو فقدان التركيز)
      // ======================================================================
      updatePaperOnly() {
        if (this._rafPaper) return;
        this._rafPaper = true;
        requestAnimationFrame(() => {
          this._rafPaper = false;
          const host = document.getElementById('pspPaperHost');
          if (!host) return;
          const tpl = PSP.state.getActiveTemplate();
          const docData = this.getPreviewDocDataFor(tpl.id);
          const rendered = PSP.renderer.renderDocument(tpl, docData, 'preview', { zoomPct: PSP.state.zoomPct });
          host.innerHTML = rendered.paperHtml;
        });
      },

      updateSidebarOnly() {
        const bodyHost = document.getElementById('pspSidebarBodyHost');
        if (!bodyHost) return;
        const prevScroll = bodyHost.scrollTop;
        bodyHost.innerHTML = this.buildSidebarBodyHtml();
        bodyHost.scrollTop = prevScroll;

        const tab = PSP.state.activeSidebarTab || 'identity';
        document.querySelectorAll('#pspSideTabsHost .psp-side-tab').forEach((b) => {
          b.classList.toggle('is-active', b.getAttribute('data-val') === tab);
        });
      },

      updateUndoRedoAndTopbarPills() {
        const h = PSP.state.getHistoryInfo();
        const uBtn = document.getElementById('pspUndoBtn');
        const rBtn = document.getElementById('pspRedoBtn');
        const cnt = document.getElementById('pspHistCounter');
        if (uBtn) uBtn.disabled = !h.canUndo;
        if (rBtn) rBtn.disabled = !h.canRedo;
        if (cnt) cnt.textContent = `${h.index + 1}/${h.total}`;

        const tpl = PSP.state.getActiveTemplate();
        document.querySelectorAll('#pspTopbarHost [data-psp-act="set-paper"]').forEach((b) => {
          b.classList.toggle('is-active', b.getAttribute('data-val') === tpl.paperSize);
        });
      },

      updateFloatingBarOnly() {
        const bar = document.getElementById('pspFloatingBarHost');
        if (!bar) return;
        const pMode = PSP.state.previewMode || 'VIP';
        const zoom = Number(PSP.state.zoomPct || 100);
        const realBadge = this.realSalesList.length > 0
          ? `#${this.realSalesList[this.realSaleIndex]?.doc_number || this.realSalesList[this.realSaleIndex]?.id}`
          : 'حقيقية';

        bar.innerHTML = `
          <button type="button" class="psp-float-btn ${pMode === 'WALKIN' ? 'is-active' : ''}" data-psp-act="set-preview-mode" data-val="WALKIN">🚶 زبون عابر</button>
          <button type="button" class="psp-float-btn ${pMode === 'VIP' ? 'is-active' : ''}" data-psp-act="set-preview-mode" data-val="VIP">👑 زبون وفي</button>
          <button type="button" class="psp-float-btn ${pMode === 'REAL_SALE' ? 'is-active' : ''}" data-psp-act="set-preview-mode" data-val="REAL_SALE">🆕 آخر فاتورة ${pMode === 'REAL_SALE' ? `(${esc(realBadge)})` : ''}</button>
          ${pMode === 'REAL_SALE' && this.realSalesList.length > 1 ? `
            <button type="button" class="psp-float-btn" style="padding:0 6px;" data-psp-act="real-sale-step" data-val="1" title="الأقدم">◀</button>
            <button type="button" class="psp-float-btn" style="padding:0 6px;" data-psp-act="real-sale-step" data-val="-1" title="الأحدث">▶</button>
          ` : ''}
          <span class="psp-float-sep"></span>
          <button type="button" class="psp-float-btn ${zoom === 75 ? 'is-active' : ''}" data-psp-act="set-zoom" data-val="75">75%</button>
          <button type="button" class="psp-float-btn ${zoom === 100 ? 'is-active' : ''}" data-psp-act="set-zoom" data-val="100">100%</button>
          <button type="button" class="psp-float-btn ${zoom === 125 ? 'is-active' : ''}" data-psp-act="set-zoom" data-val="125">125%</button>
        `;
      },

      // ======================================================================
      // 8. التركيب الشامل وتفويض الأحداث (Event Delegation)
      // ======================================================================
      renderFull() {
        const rootEl = this._mountEl || PSP.getMountRoot();
        if (!rootEl) return;

        const view = PSP.state.activeView || 'gallery';
        let bodyHtml = '';
        if (view === 'gallery') bodyHtml = this.buildGalleryViewHtml();
        else if (view === 'studio') bodyHtml = this.buildStudioViewHtml();
        else if (view === 'barcodes') bodyHtml = this.buildBarcodesViewHtml();
        else bodyHtml = this.buildWordEditorViewHtml();

        rootEl.innerHTML = `
          <div class="psp-root" id="pspStudioAppRoot" data-gherbi-print-v2="1" data-psp-studio="1">
            ${this.buildTopbarHtml()}
            ${bodyHtml}
          </div>`;

        this.bindDelegatedEvents(rootEl.querySelector('#pspStudioAppRoot'));
      },

      mount(rootEl) {
        this._mountEl = rootEl || PSP.getMountRoot();
        PSP.state.ensureAllTemplatesInitialized();
        this.loadPrintersIfAvailable();
        this.renderFull();
      },

      openDocInStudio(docId) {
        PSP.state.activeView = 'studio';
        PSP.state.setActiveDoc(docId);
        this.expandedSectionId = null;
        this.showOptionalSections = false;
        if (PSP.isPrintViewActive()) {
          this.renderFull();
        } else if (window.App && typeof window.App.switchView === 'function') {
          window.App.switchView('print');
        }
      },

      bindDelegatedEvents(appRoot) {
        if (!appRoot || this._delegatedRoot === appRoot) return;
        this._delegatedRoot = appRoot;

        // 1) النقرات (Clicks)
        appRoot.addEventListener('click', async (e) => {
          const btn = e.target.closest('[data-psp-act]');
          if (!btn || btn.disabled) return;
          const act = btn.getAttribute('data-psp-act');
          const val = btn.getAttribute('data-val');
          const docId = btn.getAttribute('data-doc');
          const secId = btn.getAttribute('data-sec');
          const field = btn.getAttribute('data-field');

          if (act === 'switch-view') {
            PSP.state.activeView = val || 'gallery';
            if (val === 'barcodes') await this.loadProductsForBarcodesIfNeeded();
            if (val === 'studio' && PSP.state.historyStack.length === 0) PSP.state.pushHistory('فتح المصمم');
            this.renderFull();
            return;
          }

          if (act === 'gallery-cat') {
            this.galleryCategory = val || 'ALL';
            const grid = document.getElementById('pspGalleryGridHost');
            if (grid) grid.innerHTML = this.buildGalleryCardsHtml();
            document.querySelectorAll('#pspGalleryCatsHost .psp-cat-pill').forEach((p) => {
              p.classList.toggle('is-active', p.getAttribute('data-val') === this.galleryCategory);
            });
            return;
          }

          if (act === 'gallery-customize') {
            this.openDocInStudio(docId);
            return;
          }

          if (act === 'gallery-test-print') {
            const tpl = PSP.state.getTemplate(docId);
            const rendered = PSP.renderer.renderDocument(tpl, this.getPreviewDocDataFor(docId), 'print');
            await dispatchPrintOrPdf(rendered.fullHtml, rendered.paperSize, false, docId);
            toast('🖨️ تم إرسال الطباعة التجريبية بنجاح!');
            return;
          }

          if (act === 'gallery-reset-doc') {
            PSP.state.resetTemplateToDefault(docId);
            const grid = document.getElementById('pspGalleryGridHost');
            if (grid) grid.innerHTML = this.buildGalleryCardsHtml();
            toast('↺ تمت استعادة القالب الافتراضي (Par Défaut).');
            return;
          }

          if (act === 'reset-all-defaults') {
            PSP.state.resetAllTemplatesToDefault();
            this.renderFull();
            toast('⚡ تم اعتماد القوالب الافتراضية المثالية لجميع الـ 37 مستنداً!');
            return;
          }

          if (act === 'prev-doc' || act === 'next-doc') {
            const docs = PSP.state.getTemplatesRegistry();
            const curIdx = docs.findIndex((d) => d.id === PSP.state.activeDocId);
            const delta = act === 'prev-doc' ? -1 : 1;
            const nextDoc = docs[(curIdx + delta + docs.length) % docs.length];
            if (nextDoc) {
              PSP.state.setActiveDoc(nextDoc.id);
              this.expandedSectionId = null;
              this.showOptionalSections = false;
              this.renderFull();
            }
            return;
          }

          if (act === 'set-paper') {
            PSP.state.mutateActiveTemplate((t) => {
              t.paperSize = val;
              t.densityMode = val === '80mm' || val === '58mm' ? 'compact' : 'normal';
              t.borderMode = val === '80mm' || val === '58mm' ? 'dashed' : 'grid';
              t.showAmountInWords = !(val === '80mm' || val === '58mm');
              t.showFiscalIds = !(val === '80mm' || val === '58mm');
            }, `تغيير المقاس (${val})`);
            this.updateTopbarAndPaper();
            return;
          }

          if (act === 'undo') {
            if (PSP.state.undo()) {
              this.updateUndoRedoAndTopbarPills();
              this.updateSidebarOnly();
              this.updatePaperOnly();
            }
            return;
          }

          if (act === 'redo') {
            if (PSP.state.redo()) {
              this.updateUndoRedoAndTopbarPills();
              this.updateSidebarOnly();
              this.updatePaperOnly();
            }
            return;
          }

          if (act === 'apply-style-all') {
            const count = PSP.state.applyStyleToAllTemplates(PSP.state.activeDocId);
            toast('🌐 تم تعميم المظهر والخط والمقاس على جميع الـ ' + count + ' مستنداً وحفظها لكل صفحات البرنامج!');
            return;
          }

          if (act === 'save-template') {
            await PSP.state.saveToDatabase(true);
            const meta = PSP.state.getDocMeta(PSP.state.activeDocId);
            toast(`✅ تم حفظ واعتماد القالب (${meta.name}) في قاعدة البيانات!`);
            return;
          }

          if (act === 'print-current' || act === 'pdf-current') {
            const tpl = PSP.state.getActiveTemplate();
            const mode = act === 'pdf-current' ? 'pdf' : 'print';
            const rendered = PSP.renderer.renderDocument(tpl, this.getPreviewDocDataFor(tpl.id), mode);
            await dispatchPrintOrPdf(rendered.fullHtml, rendered.paperSize, act === 'pdf-current', tpl.id);
            return;
          }

          if (act === 'side-tab') {
            PSP.state.activeSidebarTab = val || 'identity';
            this.updateSidebarOnly();
            return;
          }

          if (act === 'set-theme') {
            PSP.state.mutateActiveTemplate((t) => { t.themeId = val; }, 'تغيير الثيم اللوني');
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'font-dec' || act === 'font-inc') {
            PSP.state.mutateActiveTemplate((t) => {
              const cur = Number(t.baseFontSizePx || 12);
              t.baseFontSizePx = Math.max(8.5, Math.min(18, Number((cur + (act === 'font-inc' ? 0.5 : -0.5)).toFixed(1))));
            }, 'حجم الخط');
            const lbl = document.getElementById('pspFontValLbl');
            if (lbl) lbl.textContent = `${PSP.state.getActiveTemplate().baseFontSizePx}px`;
            this.updateUndoRedoAndTopbarPills();
            this.updatePaperOnly();
            return;
          }

          if (act === 'tpl-pill') {
            PSP.state.mutateActiveTemplate((t) => { t[field] = val; }, `تعديل ${field}`);
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'expand-section') {
            this.expandedSectionId = this.expandedSectionId === secId ? null : secId;
            this.updateSidebarOnly();
            return;
          }

          if (act === 'toggle-optional-secs') {
            this.showOptionalSections = !this.showOptionalSections;
            this.updateSidebarOnly();
            return;
          }

          if (act === 'move-sec-up' || act === 'move-sec-down') {
            const delta = act === 'move-sec-up' ? -1 : 1;
            PSP.state.mutateActiveTemplate((t) => {
              const arr = t.sections || [];
              const idx = arr.findIndex((s) => s.id === secId);
              const next = idx + delta;
              if (idx >= 0 && next >= 0 && next < arr.length) {
                const tmp = arr[idx]; arr[idx] = arr[next]; arr[next] = tmp;
              }
            }, 'ترتيب الأقسام');
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'sec-pill') {
            const parsedVal = field === 'fontScale' ? Number(val) : val;
            PSP.state.mutateActiveTemplate((t) => {
              const sec = (t.sections || []).find((s) => s.id === secId);
              if (sec) sec[field] = parsedVal;
            }, 'تنسيق قسم');
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'insert-var') {
            PSP.state.mutateActiveTemplate((t) => {
              const sec = (t.sections || []).find((s) => s.id === secId);
              if (sec) sec.note = ((sec.note || '') + ' ' + val).trim();
            }, 'إدراج متغير');
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'reset-sec') {
            PSP.state.mutateActiveTemplate((t) => {
              const sec = (t.sections || []).find((s) => s.id === secId);
              if (sec) {
                sec.title = ''; sec.note = ''; sec.align = 'right';
                sec.fontScale = 100; sec.border = 'default'; sec.bg = 'default';
              }
            }, 'ضبط قسم');
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'col-preset') {
            const presets = {
              thermal_simple: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
              alt_d_credit:   { index: true,  barcode: false, name: true, unit: true,  qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
              alt_h_history:  { index: true,  barcode: true,  name: true, unit: true,  qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
              z_report:       { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
              a4_full:        { index: true,  barcode: true,  name: true, unit: true,  qty: true, unitPrice: true, discount: true,  tva: true,  subtotal: true },
              bl_qty_only:    { index: true,  barcode: true,  name: true, unit: true,  qty: true, unitPrice: false, discount: false, tva: false, subtotal: false }
            };
            if (presets[val]) {
              PSP.state.mutateActiveTemplate((t) => { t.columns = { ...presets[val] }; }, 'قالب أعمدة');
              this.updateUndoRedoAndTopbarPills();
              this.updateSidebarOnly();
              this.updatePaperOnly();
            }
            return;
          }

          if (act === 'set-lang') {
            PSP.state.mutateActiveTemplate((t) => {
              t.lang = val;
              t.columnLabels = PSP.utils.deepClone(PSP.state.DEFAULT_COLUMN_LABELS[val] || PSP.state.DEFAULT_COLUMN_LABELS.ar);
            }, `اللغة (${val})`);
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'reset-active-doc') {
            PSP.state.resetTemplateToDefault(PSP.state.activeDocId);
            this.expandedSectionId = null;
            this.renderFull();
            toast('↺ تمت استعادة التصميم الافتراضي (Par Défaut).');
            return;
          }

          if (act === 'set-zoom') {
            PSP.state.zoomPct = Number(val || 100);
            this.updateFloatingBarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'set-preview-mode') {
            PSP.state.previewMode = val || 'VIP';
            if (val === 'REAL_SALE') {
              await this.loadRealSaleAtCursor();
            }
            this.updateFloatingBarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'real-sale-step') {
            const delta = Number(val || 0);
            this.realSaleIndex = Math.max(0, Math.min(this.realSalesList.length - 1, this.realSaleIndex + delta));
            await this.loadRealSaleAtCursor();
            this.updateFloatingBarOnly();
            this.updatePaperOnly();
            return;
          }

          // أحداث تبويب الباركود
          if (act === 'bc-size') {
            this.barcodeState.size = val;
            this.renderFull();
            return;
          }
          if (act === 'bc-add') {
            const pid = Number(btn.getAttribute('data-id'));
            const prod = this.barcodeState.products.find((p) => Number(p.id) === pid);
            if (prod) {
              const ex = this.barcodeState.queue.find((q) => Number(q.id) === pid);
              if (ex) ex.qty = Number(ex.qty || 1) + 1;
              else this.barcodeState.queue.push({ id: prod.id, name: prod.name, barcode: prod.barcode || String(prod.id), price: Number(prod.selling_price ?? prod.price ?? 0), qty: 2 });
              this.renderFull();
            }
            return;
          }
          if (act === 'bc-remove') {
            const idx = Number(btn.getAttribute('data-idx'));
            this.barcodeState.queue.splice(idx, 1);
            this.renderFull();
            return;
          }
          if (act === 'bc-clear') {
            this.barcodeState.queue = [];
            this.renderFull();
            return;
          }
          if (act === 'bc-print' || act === 'bc-pdf') {
            const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>@page{margin:4mm;}body{margin:0;font-family:'Cairo',Tahoma,sans-serif;direction:rtl;}.psp-barcode-sheet{display:flex;flex-wrap:wrap;gap:6px;}.psp-barcode-card{border:1px solid #cbd5e1;padding:4px 6px;text-align:center;page-break-inside:avoid;display:flex;flex-direction:column;align-items:center;justify-content:center;}</style></head><body>${this.buildBarcodePreviewHtml()}</body></html>`;
            await dispatchPrintOrPdf(html, this.barcodeState.size === 'a4' ? 'a4' : '80mm', act === 'bc-pdf', 'barcode_labels');
            return;
          }

          // أحداث تبويب المحرر الحر (Word)
          if (act === 'word-size') {
            const ed = document.getElementById('pspWordEditableArea');
            if (ed) this.wordState.htmlBody = ed.innerHTML;
            this.wordState.paperSize = val;
            this.renderFull();
            return;
          }
          if (act === 'word-cmd') {
            try { document.execCommand(val, false, null); } catch (_) {}
            return;
          }
          if (act === 'word-preset') {
            const presetBodies = {
              promo: `<h2 style="text-align:center;">🎉 عرض تخفيضات خاص لزبائننا الأوفياء</h2><p>يسرنا إعلامكم بتخفيضات استثنائية على تشكيلة واسعة من المنتجات طيلة هذا الأسبوع.</p><p><strong>ملاحظة:</strong> نقاط بطاقة الوفاء سارية ومضاعفة طيلة فترة العرض.</p>`,
              debt_ack: `<h2 style="text-align:center;">📝 وثيقة اعتراف والتزام بدين</h2><p>أنا الموقع أسفله السيد(ة): ........................................ الحامل لبطاقة التعريف رقم: ........................</p><p>أقر وأعترف بأن بذمتي لصالح المتجر مبلغاً قدره: <strong>.................... د.ج</strong>، وأتعهد بتسديده بتاريخ: ....../....../2026.</p><p style="margin-top:30px;">الإمضاء والبصمة: ................................</p>`,
              receipt_free: `<h2 style="text-align:center;">💵 وصل استلام مبلغ نقدي</h2><p>بتاريخ: ${new Date().toISOString().slice(0, 10)}</p><p>استلمنا من السيد(ة): ........................................ مبلغاً وقدره: <strong>.................... د.ج</strong></p><p>وذلك مقابل: ........................................................................</p><p style="margin-top:30px;">توقيع وختم المستلم: ................................</p>`
            };
            if (presetBodies[val]) {
              this.wordState.htmlBody = presetBodies[val];
              const ed = document.getElementById('pspWordEditableArea');
              if (ed) ed.innerHTML = this.wordState.htmlBody;
            }
            return;
          }
          if (act === 'word-print' || act === 'word-pdf') {
            const paper = document.getElementById('pspWordPrintablePaper');
            if (!paper) return;
            const clone = paper.cloneNode(true);
            clone.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
            const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>@page{margin:8mm;}body{margin:0;font-family:'Cairo',Tahoma,sans-serif;direction:rtl;color:#0f172a;}</style></head><body>${clone.innerHTML}</body></html>`;
            await dispatchPrintOrPdf(html, this.wordState.paperSize, act === 'word-pdf', 'free_document');
            return;
          }
        });

        // 2) تغييرات القوائم والمفاتيح (Change)
        appRoot.addEventListener('change', (e) => {
          const el = e.target;
          const act = el.getAttribute('data-psp-change');
          if (!act) return;

          if (act === 'select-doc') {
            PSP.state.setActiveDoc(el.value);
            this.expandedSectionId = null;
            this.showOptionalSections = false;
            this.renderFull();
            return;
          }

          if (act === 'tpl-field') {
            const field = el.getAttribute('data-field');
            PSP.state.mutateActiveTemplate((t) => { t[field] = el.value; }, `تغيير ${field}`);
            this.updateUndoRedoAndTopbarPills();
            this.updatePaperOnly();
            return;
          }

          if (act === 'tpl-bool') {
            const field = el.getAttribute('data-field');
            PSP.state.mutateActiveTemplate((t) => { t[field] = Boolean(el.checked); }, `تبديل ${field}`);
            this.updateUndoRedoAndTopbarPills();
            this.updatePaperOnly();
            return;
          }

          if (act === 'toggle-section') {
            const secId = el.getAttribute('data-sec');
            PSP.state.mutateActiveTemplate((t) => {
              const sec = (t.sections || []).find((s) => s.id === secId);
              if (sec) sec.enabled = Boolean(el.checked);
            }, 'تبديل قسم');
            this.updateUndoRedoAndTopbarPills();
            this.updateSidebarOnly();
            this.updatePaperOnly();
            return;
          }

          if (act === 'toggle-col') {
            const colKey = el.getAttribute('data-col');
            PSP.state.mutateActiveTemplate((t) => {
              if (!t.columns) t.columns = {};
              t.columns[colKey] = Boolean(el.checked);
            }, `عمود ${colKey}`);
            this.updateUndoRedoAndTopbarPills();
            this.updatePaperOnly();
            return;
          }

          if (act === 'bc-opt') {
            this.barcodeState[el.getAttribute('data-field')] = Boolean(el.checked);
            const desk = document.getElementById('pspBarcodeDeskHost');
            if (desk) desk.innerHTML = this.buildBarcodePreviewHtml();
            return;
          }

          if (act === 'word-header') {
            const ed = document.getElementById('pspWordEditableArea');
            if (ed) this.wordState.htmlBody = ed.innerHTML;
            this.wordState.includeShopHeader = Boolean(el.checked);
            this.renderFull();
          }
        });

        // 3) الكتابة الحية المباشرة بدون فقدان التركيز (Live Input <16ms)
        appRoot.addEventListener('input', (e) => {
          const el = e.target;
          const act = el.getAttribute('data-psp-input');
          if (!act) return;

          if (act === 'gallery-search') {
            this.gallerySearch = el.value;
            const grid = document.getElementById('pspGalleryGridHost');
            if (grid) grid.innerHTML = this.buildGalleryCardsHtml();
            return;
          }

          if (act === 'tpl-field' || act === 'tpl-num') {
            const field = el.getAttribute('data-field');
            const val = act === 'tpl-num' ? Number(el.value || 0) : el.value;
            PSP.state.mutateActiveTemplate((t) => { t[field] = val; }, `تعديل ${field}`, false);
            this.updatePaperOnly();
            this.scheduleDebouncedHistory(`تعديل ${field}`);
            return;
          }

          if (act === 'sec-field') {
            const secId = el.getAttribute('data-sec');
            const field = el.getAttribute('data-field');
            PSP.state.mutateActiveTemplate((t) => {
              const sec = (t.sections || []).find((s) => s.id === secId);
              if (sec) sec[field] = el.value;
            }, 'نص قسم', false);
            this.updatePaperOnly();
            this.scheduleDebouncedHistory('تعديل نص قسم');
            return;
          }

          if (act === 'col-label') {
            const colKey = el.getAttribute('data-col');
            PSP.state.mutateActiveTemplate((t) => {
              if (!t.columnLabels) t.columnLabels = {};
              t.columnLabels[colKey] = el.value;
            }, 'عنوان عمود', false);
            this.updatePaperOnly();
            this.scheduleDebouncedHistory('عنوان عمود');
            return;
          }

          if (act === 'shop-field') {
            const key = el.getAttribute('data-field');
            if (window.AppState && window.AppState.settings) {
              window.AppState.settings[key] = el.value;
            }
            this.updatePaperOnly();
            clearTimeout(this._shopSaveTimer);
            this._shopSaveTimer = setTimeout(() => {
              if (window.api && typeof window.api.updateSettings === 'function') {
                window.api.updateSettings({ [key]: el.value }).catch(() => {});
              }
            }, 450);
            return;
          }

          if (act === 'bc-search') {
            this.barcodeState.search = el.value;
            this.renderFull();
            const inp = document.querySelector('[data-psp-input="bc-search"]');
            if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
            return;
          }

          if (act === 'bc-qty') {
            const idx = Number(el.getAttribute('data-idx'));
            if (this.barcodeState.queue[idx]) {
              this.barcodeState.queue[idx].qty = Math.max(1, Number(el.value || 1));
              const desk = document.getElementById('pspBarcodeDeskHost');
              if (desk) desk.innerHTML = this.buildBarcodePreviewHtml();
            }
          }
        });
      },

      updateTopbarAndPaper() {
        this.updateUndoRedoAndTopbarPills();
        this.updateSidebarOnly();
        this.updatePaperOnly();
      },

      scheduleDebouncedHistory(label) {
        clearTimeout(this._historyDebounce);
        this._historyDebounce = setTimeout(() => {
          PSP.state.pushHistory(label);
          this.updateUndoRedoAndTopbarPills();
        }, 550);
      }
    };

    // اختصارات لوحة المفاتيح العالمية لـ Undo (Ctrl+Z) و Redo (Ctrl+Y) داخل المصمم البصري
    if (!window._pspKeyboardUndoBound) {
      window._pspKeyboardUndoBound = true;
      window.addEventListener('keydown', (e) => {
        if (!PSP.isPrintViewActive() || PSP.state.activeView !== 'studio') return;
        const tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;

        const key = String(e.key || '').toLowerCase();
        if (e.ctrlKey && !e.shiftKey && key === 'z') {
          e.preventDefault();
          if (PSP.state.undo()) {
            UI.updateUndoRedoAndTopbarPills();
            UI.updateSidebarOnly();
            UI.updatePaperOnly();
          }
        } else if ((e.ctrlKey && key === 'y') || (e.ctrlKey && e.shiftKey && key === 'z')) {
          e.preventDefault();
          if (PSP.state.redo()) {
            UI.updateUndoRedoAndTopbarPills();
            UI.updateSidebarOnly();
            UI.updatePaperOnly();
          }
        }
      });
    }

    PSP.ui = UI;
    PSP.modules.ui = true;
    PSP.stage = Math.max(PSP.stage || 1, 4);

    if (PSP.isPrintViewActive()) {
      PSP.mount();
    }

    console.log('✅ [Print Studio Pro — Stage 4/UI]: الواجهة العالمية (معرض الـ 34 + المصمم البصري + الباركود + المحرر الحر) جاهزة 100%.');
  })();
})();

/* === [PSP NATIVE Z-REPORT EXECUTIVE TOOLS PANEL IN PRINT STUDIO UI] === */
(function installPspNativeZReportStudioToolsPanelV2() {
  'use strict';

  const Z_DOC_IDS = new Set(['caisse_z_report', 'caisse_shift_full_audit_a4']);
  const Z_ALL_SECTIONS = [
    { id: 'shop_header', label: '🏢 ترويسة المتجر والشعار' },
    { id: 'shift_cash_debt_balance', label: '🏦 ميزان الوردية المزدوج (الدرج + السنتيم + الديون)' },
    { id: 'shift_flows_summary', label: '📊 معادلة حركة السيولة النقدية بالدرج' },
    { id: 'shift_owner_alerts', label: '🛡️ رادار تنبيهات الرقابة لصاحب المتجر' },
    { id: 'shift_outflows_detail', label: '💸 دفتر الأموال الخارجة (المستفيد + السبب + الساعة)' },
    { id: 'shift_credit_sales_today', label: '📝 دفتر زبائن الكريدي اليوم (ديون الوردية)' },
    { id: 'shift_debt_collections', label: '🤝 سجل تحصيلات الديون بأسماء الزبائن' },
    { id: 'shift_payment_kpis', label: '💳 تفصيل وسائل الدفع ومؤشرات الأداء (KPIs)' },
    { id: 'shift_top_debtors', label: '📌 قائمة أكبر المدينين للمتابعة غداً' },
    { id: 'items_table', label: '📋 جدول سطور الحركات الكلاسيكي (اختياري)' },
    { id: 'caisse_billetage', label: '🔒 صندوق مطابقة الجرد الإضافي (اختياري)' },
    { id: 'dual_signatures', label: '✍️ مربعات التوقيع والمصادقة (أسفل المحضر)' },
    { id: 'footer_terms', label: '✒️ التذييل الرسمي المعتمد للوثيقة' }
  ];

  function refreshStudioAndCaisse(PSP) {
    if (PSP.ui && typeof PSP.ui.renderLivePreview === 'function') {
      PSP.ui.renderLivePreview();
    } else if (PSP.ui && typeof PSP.ui.refreshEditor === 'function') {
      PSP.ui.refreshEditor();
    }
    // إخطار نافذة مراجعة الصندوق إن كانت مفتوحة لإعادة قراءة القالب المحدث فوراً
    const bodyEl = document.getElementById('reviewCaisseModalBody');
    if (bodyEl && bodyEl.dataset) delete bodyEl.dataset.pspAdoptedSession;
    const modalEl = document.getElementById('reviewCaisseModal');
    if (modalEl && modalEl.dataset) delete modalEl.dataset.pspCaisseAdoptedSig;
  }

  function injectOrUpdateZToolsPanelV2() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state) return;

    const rootEl = PSP.getMountRoot ? PSP.getMountRoot() : document.getElementById('print-view-root');
    if (!rootEl) return;

    const existing = rootEl.querySelector('#pspNativeZReportToolsCard');
    const activeDocId = PSP.state.activeDocId;

    if (!Z_DOC_IDS.has(activeDocId)) {
      if (existing) existing.remove();
      return;
    }

    const tpl = PSP.state.getTemplate(activeDocId);
    const sOpts = tpl.shiftOptions || {};

    const sidebarHost =
      rootEl.querySelector('.psp-sidebar-body') ||
      rootEl.querySelector('.psp-sidebar, .psp-editor-sidebar, .psp-inspector, .psp-panel');
    if (!sidebarHost) return;

    const card = existing || document.createElement('div');
    card.id = 'pspNativeZReportToolsCard';
    card.style.cssText =
      'margin:8px 0;padding:10px;border-radius:12px;border:1.5px solid #0284c7;background:linear-gradient(180deg,#f0f9ff 0%,#ffffff 100%);direction:rtl;text-align:right;';

    const secChecksHtml = Z_ALL_SECTIONS.map((item) => {
      const secObj = (tpl.sections || []).find((s) => s && s.id === item.id);
      const checked = secObj && secObj.enabled ? 'checked' : '';
      return (
        `<label style="display:flex;align-items:center;gap:6px;font-size:10.8px;font-weight:800;color:#0f172a;padding:2.5px 0;cursor:pointer;">` +
        `<input type="checkbox" data-ztool-sec="${item.id}" ${checked} style="width:14px;height:14px;accent-color:#0284c7;cursor:pointer;" />` +
        `<span>${item.label}</span>` +
        `</label>`
      );
    }).join('');

    const lim = Number(sOpts.topDebtorsLimit || 5);
    const sigM = sOpts.signatureMode || (tpl.paperSize === 'a4' ? 'triple' : 'dual');

    card.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1.5px dashed #7dd3fc;padding-bottom:6px;margin-bottom:6px;">` +
      `<span style="font-size:12px;font-weight:900;color:#0369a1;">🎛️ أدوات محضر إغلاق الوردية الشامل</span>` +
      `<span style="font-size:9.5px;font-weight:800;background:#0284c7;color:#fff;padding:2px 6px;border-radius:6px;">${tpl.paperSize.toUpperCase()}</span>` +
      `</div>` +
      `<div style="font-size:10.5px;font-weight:900;color:#334155;margin-bottom:3px;">1️⃣ أقسام المحضر (إظهار / إخفاء فوري):</div>` +
      `<div style="max-height:215px;overflow-y:auto;padding-left:4px;margin-bottom:8px;border:1px solid #e0f2fe;border-radius:8px;padding:4px 6px;background:#fff;">${secChecksHtml}</div>` +
      `<div style="font-size:10.5px;font-weight:900;color:#334155;border-top:1px dashed #bae6fd;padding-top:6px;margin-bottom:4px;">2️⃣ خيارات التفاصيل الدقيقة (تُطبَّق على الصندوق):</div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10.2px;font-weight:800;color:#1e293b;margin-bottom:6px;">` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-ztool-opt="showShiftTimes" ${sOpts.showShiftTimes !== false ? 'checked' : ''} /> الافتتاح والإغلاق</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-ztool-opt="showDrawerCentimes" ${sOpts.showDrawerCentimes !== false ? 'checked' : ''} /> الرصيد بالسنتيم</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-ztool-opt="showBeneficiary" ${sOpts.showBeneficiary !== false ? 'checked' : ''} /> اسم المستفيد</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-ztool-opt="showOutflowTime" ${sOpts.showOutflowTime !== false ? 'checked' : ''} /> ساعة الصرف</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-ztool-opt="showCustomerPhone" ${sOpts.showCustomerPhone !== false ? 'checked' : ''} /> هاتف الزبون</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-ztool-opt="showCumulativeDebt" ${sOpts.showCumulativeDebt !== false ? 'checked' : ''} /> الدين التراكمي</label>` +
      `<label style="grid-column:span 2;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-ztool-opt="showZeroEmptySections" ${sOpts.showZeroEmptySections !== false ? 'checked' : ''} /> إظهار الأقسام الفارغة (أوقفه لاختصار طول الورق الحراري)</label>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">` +
      `<div><div style="font-size:10px;font-weight:800;color:#475569;margin-bottom:2px;">عدد أكبر المدينين:</div>` +
      `<select data-ztool-sel="topDebtorsLimit" style="width:100%;height:28px;border-radius:7px;border:1px solid #cbd5e1;font-size:10.5px;font-weight:800;padding:0 5px;">` +
      `<option value="3" ${lim === 3 ? 'selected' : ''}>أعلى 3 مدينين</option>` +
      `<option value="5" ${lim === 5 ? 'selected' : ''}>أعلى 5 مدينين</option>` +
      `<option value="8" ${lim === 8 ? 'selected' : ''}>أعلى 8 مدينين</option>` +
      `<option value="12" ${lim === 12 ? 'selected' : ''}>أعلى 12 مدين</option>` +
      `</select></div>` +
      `<div><div style="font-size:10px;font-weight:800;color:#475569;margin-bottom:2px;">نمط التوقيعات:</div>` +
      `<select data-ztool-sel="signatureMode" style="width:100%;height:28px;border-radius:7px;border:1px solid #cbd5e1;font-size:10.5px;font-weight:800;padding:0 5px;">` +
      `<option value="dual" ${sigM === 'dual' ? 'selected' : ''}>مزدوج (كاشير + مدير)</option>` +
      `<option value="triple" ${sigM === 'triple' ? 'selected' : ''}>ثلاثي (كاشير + مراجع + مدير)</option>` +
      `</select></div>` +
      `</div>` +
      `<div style="display:grid;grid-template-columns:1fr 1.6fr;gap:6px;">` +
      `<button type="button" data-ztool-reset-order="1" style="height:32px;border-radius:8px;border:1px solid #0284c7;background:#ffffff;color:#0369a1;font-size:10.5px;font-weight:900;cursor:pointer;">↺ ترتيب مثالي</button>` +
      `<button type="button" data-ztool-adopt="1" style="height:32px;border-radius:8px;border:none;background:#047857;color:#ffffff;font-size:10.8px;font-weight:900;cursor:pointer;">✅ اعتماد وتطبيق بالصندوق</button>` +
      `</div>`;

    if (!existing) {
      sidebarHost.insertBefore(card, sidebarHost.firstChild);
    }

    if (!card._zEventsBoundV2) {
      card._zEventsBoundV2 = true;
      card.addEventListener('change', (ev) => {
        const el = ev.target;
        if (!el) return;
        const secId = el.getAttribute('data-ztool-sec');
        const optKey = el.getAttribute('data-ztool-opt');
        const selKey = el.getAttribute('data-ztool-sel');

        if (secId) {
          PSP.state.mutateActiveTemplate((t) => {
            const targetSec = (t.sections || []).find((s) => s && s.id === secId);
            if (targetSec) targetSec.enabled = Boolean(el.checked);
          }, 'تبديل قسم الوردية: ' + secId);
          refreshStudioAndCaisse(PSP);
        } else if (optKey) {
          PSP.state.mutateActiveTemplate((t) => {
            if (!t.shiftOptions) t.shiftOptions = {};
            t.shiftOptions[optKey] = Boolean(el.checked);
          }, 'تعديل أداة الوردية: ' + optKey);
          refreshStudioAndCaisse(PSP);
        } else if (selKey) {
          PSP.state.mutateActiveTemplate((t) => {
            if (!t.shiftOptions) t.shiftOptions = {};
            t.shiftOptions[selKey] = selKey === 'topDebtorsLimit' ? Number(el.value) : String(el.value);
          }, 'تعديل إعداد الوردية: ' + selKey);
          refreshStudioAndCaisse(PSP);
        }
      });

      card.addEventListener('click', (ev) => {
        const resetBtn = ev.target && ev.target.closest ? ev.target.closest('[data-ztool-reset-order="1"]') : null;
        if (resetBtn) {
          PSP.state.mutateActiveTemplate((t) => {
            if (typeof PSP.state.applyIdealZReportOrder === 'function') {
              PSP.state.applyIdealZReportOrder(t);
            }
          }, 'الترتيب الاحترافي المثالي للوردية');
          refreshStudioAndCaisse(PSP);
          setTimeout(injectOrUpdateZToolsPanelV2, 30);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast('✨ تم ضبط الترتيب الاحترافي المثالي بدون أي تكرار!', 'success');
          }
          return;
        }

        const adoptBtn = ev.target && ev.target.closest ? ev.target.closest('[data-ztool-adopt="1"]') : null;
        if (adoptBtn) {
          PSP.state.persistLocal();
          PSP.state.saveToDatabase(true);
          refreshStudioAndCaisse(PSP);
          if (window.App && typeof window.App.showToast === 'function') {
            window.App.showToast('✅ تم اعتماد التصميم وحفظه — سيُطبَّق فوراً في إدارة الصندوق وكافة الصفحات!', 'success');
          }
        }
      });
    }
  }

  function bootZToolsV2() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state) return false;
    if (PSP._zToolsPanelInstalledV2) return true;
    PSP._zToolsPanelInstalledV2 = true;

    if (typeof PSP.state.on === 'function') {
      PSP.state.on('doc-changed', () => setTimeout(injectOrUpdateZToolsPanelV2, 30));
      PSP.state.on('template-changed', () => setTimeout(injectOrUpdateZToolsPanelV2, 30));
      PSP.state.on('reset', () => setTimeout(injectOrUpdateZToolsPanelV2, 30));
    }

    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const rootEl = document.getElementById('print-view-root');
      if (rootEl && !rootEl._zToolsObsV2) {
        rootEl._zToolsObsV2 = true;
        let t = null;
        const obs = new MutationObserver(() => {
          clearTimeout(t);
          t = setTimeout(injectOrUpdateZToolsPanelV2, 50);
        });
        obs.observe(rootEl, { childList: true, subtree: true });
      }
    }

    setTimeout(injectOrUpdateZToolsPanelV2, 80);
    return true;
  }

  if (!bootZToolsV2()) {
    let n = 0;
    const iv = setInterval(() => {
      n++;
      if (bootZToolsV2() || n >= 40) clearInterval(iv);
    }, 100);
  }
})();

/* === [WAR STAGE 6B2: EXPENSE VOUCHERS & OUTFLOWS STUDIO TOOLS PANEL] === */
(function installPspNativeExpenseStudioToolsPanel() {
  'use strict';

  const EXP_DOC_IDS = new Set(['expense_voucher', 'expense_voucher_a4', 'expenses_period_report_a4', 'expenses_period_report_80mm']);
  const VOUCHER_SECS = [
    { id: 'shop_header', label: '🏢 ترويسة المتجر والشعار' },
    { id: 'expense_voucher_card', label: '🧾 بطاقة سند الصرف (المبلغ + المستفيد + المصدر)' },
    { id: 'dual_signatures', label: '✍️ مربعات التوقيع والمصادقة' },
    { id: 'footer_terms', label: '✒️ التذييل الرسمي المعتمد' }
  ];
  const REPORT_SECS = [
    { id: 'shop_header', label: '🏢 ترويسة المتجر والشعار' },
    { id: 'outflows_report_kpis', label: '📊 بطاقات مؤشرات إجمالي المصاريف والمدفوعات' },
    { id: 'outflows_by_source_box', label: '🏦 توزيع الأموال حسب الـ 4 مصادر' },
    { id: 'outflows_by_category_box', label: '🗂️ توزيع الفئات والنسب المئوية %' },
    { id: 'outflows_detail_table', label: '📋 جدول السندات والعمليات التفصيلي' },
    { id: 'dual_signatures', label: '✍️ مربعات التوقيع والمصادقة' },
    { id: 'footer_terms', label: '✒️ التذييل الرسمي المعتمد' }
  ];

  function injectOrUpdateExpenseToolsPanel() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state) return;
    const rootEl = PSP.getMountRoot ? PSP.getMountRoot() : document.getElementById('print-view-root');
    if (!rootEl) return;

    const existing = rootEl.querySelector('#pspNativeExpenseToolsCard');
    const activeDocId = PSP.state.activeDocId;
    if (!EXP_DOC_IDS.has(activeDocId)) {
      if (existing) existing.remove();
      return;
    }

    const sidebarHost = rootEl.querySelector('.psp-sidebar-body') || rootEl.querySelector('.psp-sidebar, .psp-editor-sidebar');
    if (!sidebarHost) return;

    const tpl = PSP.state.getTemplate(activeDocId);
    const eOpts = tpl.expenseOptions || {};
    const isVoucher = activeDocId === 'expense_voucher' || activeDocId === 'expense_voucher_a4';
    const secList = isVoucher ? VOUCHER_SECS : REPORT_SECS;

    const card = existing || document.createElement('div');
    card.id = 'pspNativeExpenseToolsCard';
    card.style.cssText = 'margin:8px 0;padding:10px;border-radius:12px;border:1.5px solid #e11d48;background:linear-gradient(180deg,#fff1f2 0%,#ffffff 100%);direction:rtl;text-align:right;';

    const checksHtml = secList.map((item) => {
      const secObj = (tpl.sections || []).find((s) => s && s.id === item.id);
      const checked = secObj && secObj.enabled ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:6px;font-size:10.8px;font-weight:800;color:#0f172a;padding:2.5px 0;cursor:pointer;"><input type="checkbox" data-exptool-sec="${item.id}" ${checked} style="width:14px;height:14px;accent-color:#e11d48;" /><span>${item.label}</span></label>`;
    }).join('');

    const sigM = eOpts.signatureMode || (tpl.paperSize === 'a4' ? 'triple' : 'dual');

    card.innerHTML =
      `<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1.5px dashed #fda4af;padding-bottom:6px;margin-bottom:6px;">` +
      `<span style="font-size:11.8px;font-weight:900;color:#9f1239;">🎛️ أدوات سندات وتقارير المصاريف</span>` +
      `<span style="font-size:9.5px;font-weight:800;background:#e11d48;color:#fff;padding:2px 6px;border-radius:6px;">${tpl.paperSize.toUpperCase()}</span>` +
      `</div>` +
      `<div style="font-size:10.5px;font-weight:900;color:#334155;margin-bottom:3px;">1️⃣ أقسام السند / التقرير:</div>` +
      `<div style="background:#fff;border:1px solid #fecdd3;border-radius:8px;padding:4px 6px;margin-bottom:8px;">${checksHtml}</div>` +
      `<div style="font-size:10.5px;font-weight:900;color:#334155;border-top:1px dashed #fda4af;padding-top:6px;margin-bottom:4px;">2️⃣ خيارات التفاصيل:</div>` +
      `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:10.2px;font-weight:800;color:#1e293b;margin-bottom:6px;">` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-exptool-opt="showFundingSource" ${eOpts.showFundingSource !== false ? 'checked' : ''} /> مصدر المال</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-exptool-opt="showBeneficiary" ${eOpts.showBeneficiary !== false ? 'checked' : ''} /> اسم المستفيد</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-exptool-opt="showCentimes" ${eOpts.showCentimes !== false ? 'checked' : ''} /> المبلغ بالسنتيم</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-exptool-opt="showAmountInWords" ${eOpts.showAmountInWords !== false ? 'checked' : ''} /> التفقيط بالحروف</label>` +
      `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" data-exptool-opt="showShiftRef" ${eOpts.showShiftRef !== false ? 'checked' : ''} /> رقم الوردية</label>` +
      `</div>` +
      `<div style="margin-bottom:8px;">` +
      `<div style="font-size:10px;font-weight:800;color:#475569;margin-bottom:2px;">نمط التوقيعات:</div>` +
      `<select data-exptool-sel="signatureMode" style="width:100%;height:28px;border-radius:7px;border:1px solid #cbd5e1;font-size:10.5px;font-weight:800;padding:0 6px;">` +
      `<option value="dual" ${sigM === 'dual' ? 'selected' : ''}>مزدوج (المستفيد / الكاشير + صاحب المتجر)</option>` +
      `<option value="triple" ${sigM === 'triple' ? 'selected' : ''}>ثلاثي (المستفيد + المحاسب + صاحب المتجر)</option>` +
      `</select></div>` +
      `<button type="button" data-exptool-adopt="1" style="width:100%;height:32px;border-radius:8px;border:none;background:#047857;color:#ffffff;font-size:11px;font-weight:900;cursor:pointer;">✅ اعتماد وتطبيق على صفحة المصاريف فوراً</button>`;

    if (!existing) sidebarHost.insertBefore(card, sidebarHost.firstChild);

    if (!card._expToolsBound) {
      card._expToolsBound = true;
      card.addEventListener('change', (ev) => {
        const el = ev.target;
        if (!el) return;
        const secId = el.getAttribute('data-exptool-sec');
        const optKey = el.getAttribute('data-exptool-opt');
        const selKey = el.getAttribute('data-exptool-sel');
        if (secId) {
          PSP.state.mutateActiveTemplate((t) => {
            const target = (t.sections || []).find((s) => s && s.id === secId);
            if (target) target.enabled = Boolean(el.checked);
          }, 'تبديل قسم سند/تقرير المصاريف');
        } else if (optKey) {
          PSP.state.mutateActiveTemplate((t) => {
            if (!t.expenseOptions) t.expenseOptions = {};
            t.expenseOptions[optKey] = Boolean(el.checked);
          }, 'تعديل خيار المصاريف');
        } else if (selKey) {
          PSP.state.mutateActiveTemplate((t) => {
            if (!t.expenseOptions) t.expenseOptions = {};
            t.expenseOptions[selKey] = String(el.value);
          }, 'تعديل توقيعات المصاريف');
        }
        PSP.ui?.renderLivePreview?.();
      });

      card.addEventListener('click', (ev) => {
        const btn = ev.target && ev.target.closest ? ev.target.closest('[data-exptool-adopt="1"]') : null;
        if (!btn) return;
        PSP.state.persistLocal();
        PSP.state.saveToDatabase(true);
        window.App?.showToast?.('✅ تم اعتماد تصميم سند/تقرير المصاريف وسيُطبَّق فوراً في صفحة المصاريف!', 'success');
      });
    }
  }

  function bootExpTools() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state) return false;
    if (PSP._expToolsPanelInstalled) return true;
    PSP._expToolsPanelInstalled = true;

    if (typeof PSP.state.on === 'function') {
      PSP.state.on('doc-changed', () => setTimeout(injectOrUpdateExpenseToolsPanel, 30));
      PSP.state.on('template-changed', () => setTimeout(injectOrUpdateExpenseToolsPanel, 30));
    }

    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const rootEl = document.getElementById('print-view-root');
      if (rootEl && !rootEl._expToolsObs) {
        rootEl._expToolsObs = true;
        let t = null;
        const obs = new MutationObserver(() => {
          clearTimeout(t);
          t = setTimeout(injectOrUpdateExpenseToolsPanel, 50);
        });
        obs.observe(rootEl, { childList: true, subtree: true });
      }
    }
    setTimeout(injectOrUpdateExpenseToolsPanel, 90);
    return true;
  }

  if (!bootExpTools()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (bootExpTools() || k >= 40) clearInterval(iv);
    }, 100);
  }
})();

/* === [WAR STAGE 6C: Z-REPORT EXTERNAL FUNDING SIDEBAR TOGGLE] === */
(function installPspStage6CZReportExtFundingTool() {
  'use strict';

  const Z_IDS = new Set(["receipt_thermal","caisse_z_report","caisse_shift_full_audit_a4","caisse_cash_in_voucher_80mm"]);

  function syncZReportExtTool() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state) return;
    const rootEl = PSP.getMountRoot ? PSP.getMountRoot() : document.getElementById('print-view-root');
    if (!rootEl) return;

    const existing = rootEl.querySelector('#pspStage6CShiftExtToolBox');
    const activeDocId = PSP.state.activeDocId;
    if (!Z_IDS.has(activeDocId)) {
      if (existing) existing.remove();
      return;
    }

    const sidebarHost = rootEl.querySelector('.psp-sidebar-body') || rootEl.querySelector('.psp-sidebar, .psp-editor-sidebar');
    if (!sidebarHost) return;

    const tpl = PSP.state.getTemplate(activeDocId);
    const secObj = (tpl.sections || []).find((s) => s && s.id === 'shift_external_funding_box');
    const isEnabled = Boolean((tpl.shiftOptions ? tpl.shiftOptions.showExternalFundingSection !== false : true) && (!secObj || secObj.enabled !== false));

    const box = existing || document.createElement('div');
    box.id = 'pspStage6CShiftExtToolBox';
    box.style.cssText = 'margin:6px 0;padding:8px 10px;border-radius:10px;border:1.5px solid #0284c7;background:linear-gradient(135deg,#f0f9ff 0%,#ffffff 100%);direction:rtl;text-align:right;';
    box.innerHTML =
      '<label style="display:flex;align-items:flex-start;gap:7px;cursor:pointer;font-size:11px;font-weight:900;color:#0c4a6e;">' +
      '<input type="checkbox" data-s6c-zext-toggle="1" ' + (isEnabled ? 'checked' : '') + ' style="width:15px;height:15px;margin-top:2px;accent-color:#0284c7;" />' +
      '<span>🏦 إظهار قسم "المعاملات المموّلة خارج درج الكاشير" (الخزينة الرئيسية / البنك-CCP / المال الخارجي — بدون خصم من الدرج)</span>' +
      '</label>';

    if (!existing) {
      const zToolsCard = rootEl.querySelector('#pspNativeZReportToolsCard');
      if (zToolsCard && zToolsCard.parentNode) {
        zToolsCard.parentNode.insertBefore(box, zToolsCard.nextSibling);
      } else {
        sidebarHost.insertBefore(box, sidebarHost.firstChild);
      }
    }

    if (!box._s6cBound) {
      box._s6cBound = true;
      box.addEventListener('change', (ev) => {
        const chk = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-s6c-zext-toggle') ? ev.target : null;
        if (!chk) return;
        const val = Boolean(chk.checked);
        PSP.state.mutateActiveTemplate((t) => {
          if (!t.shiftOptions) t.shiftOptions = {};
          t.shiftOptions.showExternalFundingSection = val;
          const target = (t.sections || []).find((s) => s && s.id === 'shift_external_funding_box');
          if (target) target.enabled = val;
        }, 'تبديل قسم المعاملات خارج درج الكاشير');
        PSP.ui?.renderLivePreview?.();
      });
    }
  }

  function bootS6CTool() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state) return false;
    if (PSP._s6cZExtToolBooted) return true;
    PSP._s6cZExtToolBooted = true;

    if (typeof PSP.state.on === 'function') {
      PSP.state.on('doc-changed', () => setTimeout(syncZReportExtTool, 35));
      PSP.state.on('template-changed', () => setTimeout(syncZReportExtTool, 35));
    }
    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      const rootEl = document.getElementById('print-view-root');
      if (rootEl && !rootEl._s6cZToolObs) {
        rootEl._s6cZToolObs = true;
        let t = null;
        const obs = new MutationObserver(() => {
          clearTimeout(t);
          t = setTimeout(syncZReportExtTool, 50);
        });
        obs.observe(rootEl, { childList: true, subtree: true });
      }
    }
    setTimeout(syncZReportExtTool, 100);
    return true;
  }

  if (!bootS6CTool()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (bootS6CTool() || k >= 40) clearInterval(iv);
    }, 100);
  }
})();
