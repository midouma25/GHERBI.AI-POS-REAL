/**
 * gherbi-v7-stage3-pro-scale.js
 * المحرك التنفيذي للشطر الثالث (الإصدار 7):
 * - تطوير نافذة الميزان الإلكتروني المباشر (#posScaleModal — الصورة الثالثة)
 * - حساب السعر الحي بالوزن (كغ / غرام) أو بالمبلغ العكسي (بيع بمبلغ د.ج)
 * - مفكك باركود الميزان الذكي (EAN-13 Scale Barcodes 20 / 21 / 22)
 */

'use strict';

(function initGherbiV7Stage3Scale() {
  const V7Scale = {
    currentWeightKg: 0.5,
    selectedProductId: null,
    onlyWeightedFilter: false,

    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.upgradePosScaleModalDom();
        this.hookScaleOpenAndLiveEvents();
        this.hookEan13ScaleBarcodeDecoder();
        console.log('🚀 [Gherbi V7 - Stage 3]: محطة الميزان الإلكتروني المباشر وقارئ باركود الميزان (20/21/22) جاهزة.');
      }, 220);
    },

    // ========================================================================
    // 1. إعادة بناء نافذة الميزان الإلكتروني المباشر (#posScaleModal) بتصميم احترافي
    // ========================================================================
    upgradePosScaleModalDom() {
      const modal = document.getElementById('posScaleModal');
      if (!modal) return;

      modal.innerHTML = `
        <div class="modal-content bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-2xl text-xs">
          <!-- الهيدر -->
          <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <span class="material-symbols-rounded">scale</span>
              </div>
              <div>
                <h3 class="text-sm font-black text-white">محطة الميزان الإلكتروني وحاسبة الوزن الفورية</h3>
                <p class="text-[10.5px] text-slate-400">تدعم القراءة الحية من الميزان بالكابل (USB/COM) أو اختيار الوزن السريع أو البيع بمبلغ محدد</p>
              </div>
            </div>
            <button type="button" onclick="App.closeModal('posScaleModal')" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white font-black">✕</button>
          </div>

          <div class="p-5 space-y-4">
            <!-- الشاشة الرقمية المزدوجة: الوزن الصافي + السعر الإجمالي المحسوب لحظياً -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950 text-white border-2 border-emerald-500/50 shadow-inner">
              <div class="text-center border-l border-slate-800 pl-3 flex flex-col justify-center">
                <div class="text-[11px] text-slate-400 font-bold mb-1">الوزن الصافي المستقر ( بالكيلوغرام والغرام )</div>
                <div id="scaleModalWeightDisplay" class="text-4xl font-mono font-black text-emerald-400" dir="ltr">0.500 kg</div>
                <div id="scaleModalGramHelper" class="text-xs font-mono font-bold text-amber-400 mt-1">⚖️ يعادل: 500 غرام (رطل)</div>
              </div>

              <div class="text-center flex flex-col justify-center">
                <div class="text-[11px] text-slate-400 font-bold mb-1">المبلغ المحسوب لهذا الوزن</div>
                <div id="scaleModalComputedPriceDzd" class="text-3xl font-mono font-black text-sky-400">0.00 د.ج</div>
                <div id="scaleModalComputedCentimes" class="text-xs font-bold text-amber-300 mt-1">🇩🇿 بالسنتيم: 0 سنتيم</div>
              </div>
            </div>

            <!-- اختيار السلعة الموزونة مع بحث فوري -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="font-black text-slate-700 dark:text-slate-200">1. اختر السلعة المراد وزنها وتسعيرها:</label>
                <input id="scaleProductFilterInp" type="text" oninput="GherbiV7Stage3.populateScaleProducts(this.value)"
                  placeholder="🔍 ابحث عن سلعة بالاسم أو كود PLU..."
                  class="w-56 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-bold text-xs">
              </div>
              <select id="scaleModalProductSelect" onchange="GherbiV7Stage3.onScaleProductChange(this.value)"
                class="w-full px-3 py-2.5 rounded-xl border-2 border-blue-500/50 font-black text-xs bg-slate-50 dark:bg-slate-800"></select>
            </div>

            <!-- أزرار الأوزان الجزائرية الجاهزة بلمسة واحدة -->
            <div class="space-y-1.5">
              <label class="block font-black text-slate-700 dark:text-slate-200">2. اختر وزناً سريعاً بلمسة واحدة أو اقرأ من الميزان:</label>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.100)" data-wpreset="0.1" class="scale-preset-pill">100 غ</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.200)" data-wpreset="0.2" class="scale-preset-pill">200 غ</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.250)" data-wpreset="0.25" class="scale-preset-pill">250 غ (ربع)</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(0.500)" data-wpreset="0.5" class="scale-preset-pill active">500 غ (رطل)</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(1.000)" data-wpreset="1" class="scale-preset-pill">1 كغ</button>
                <button type="button" onclick="GherbiV7Stage3.setWeightKg(2.000)" data-wpreset="2" class="scale-preset-pill">2 كغ</button>
              </div>
            </div>

            <!-- إدخال يدوي للوزن (كغ) ⇄ أو إدخال المبلغ المطلوب بالدينار لحساب الوزن عكسياً -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div>
                <label class="block font-black text-emerald-700 dark:text-emerald-400 mb-1">⚖️ كتابة الوزن يدوياً (بالكيلوغرام kg):</label>
                <input id="scaleManualWeightInput" type="number" step="0.001" min="0.001" value="0.500"
                  oninput="GherbiV7Stage3.setWeightKg(this.value, false)"
                  class="w-full px-3 py-2 rounded-xl border-2 border-emerald-500 font-mono font-black text-sm text-center">
              </div>
              <div>
                <label class="block font-black text-indigo-600 dark:text-indigo-400 mb-1">💵 أو البيع بمبلغ (اكتب كم أعطاك الزبون د.ج):</label>
                <input id="scaleTargetAmountDzdInput" type="number" step="any" min="1" placeholder="مثال: بـ 150 د.ج..."
                  oninput="GherbiV7Stage3.calcWeightFromMoneyDzd(this.value)"
                  class="w-full px-3 py-2 rounded-xl border-2 border-indigo-500 font-mono font-black text-sm text-center">
              </div>
            </div>

            <!-- أزرار التحكم الفيزيائي في الميزان المربوط بالكابل -->
            <div class="grid grid-cols-3 gap-2">
              <button type="button" onclick="GherbiV7Stage3.sendScaleCommand('zero')" class="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700">
                🔄 تصفير الميزان (Zero)
              </button>
              <button type="button" onclick="GherbiV7Stage3.sendScaleCommand('tare')" class="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl font-bold border border-slate-200 dark:border-slate-700">
                🥣 خصم العلبة (Tare)
              </button>
              <button type="button" onclick="GherbiV7Stage3.sendScaleCommand('readOnce')" class="py-2 bg-blue-600/15 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl font-black transition">
                📡 قراءة من الكابل الآن
              </button>
            </div>

            <!-- زر الإدراج النهائي في السلة -->
            <button type="button" onclick="GherbiV7Stage3.confirmAddWeightedItemToCart()"
              class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2">
              <span class="material-symbols-rounded">add_shopping_cart</span>
              <span>إضافة الوزن والسعر المحسوب إلى السلة (Enter)</span>
            </button>
          </div>
        </div>
      `;
    },

    hookScaleOpenAndLiveEvents() {
      window.App.openPosScaleModal = () => {
        this.upgradePosScaleModalDom();
        this.populateScaleProducts('');

        // قراءة الوزن الحي إن كان الميزان يبث وزناً أكبر من 0
        const liveTxt = document.getElementById('liveScaleWeight')?.textContent || '0';
        const parsedLive = parseFloat(liveTxt.replace(/[^\d.]/g, '')) || 0;
        this.setWeightKg(parsedLive > 0 ? parsedLive : 0.5, true);

        window.App.openModal('posScaleModal');
      };

      window.App.addWeightedProductFromScaleModal = () => this.confirmAddWeightedItemToCart();
    },

    populateScaleProducts(query = '') {
      const sel = document.getElementById('scaleModalProductSelect');
      if (!sel) return;
      const q = String(query || '').trim().toLowerCase();
      const allProds = (window.AppState?.products || []).filter((p) => !p.hide_from_pos);

      // وضع السلع الموزونة (التي وحدتها كغ/متر أو لها كود ميزان PLU) في المقدمة دائماً
      const sorted = [...allProds].sort((a, b) => {
        const aIsWeighted = (a.plu_code && String(a.plu_code).trim() !== '') || /كغ|kg|غرام|وزن|ميزان/i.test(a.unit || '');
        const bIsWeighted = (b.plu_code && String(b.plu_code).trim() !== '') || /كغ|kg|غرام|وزن|ميزان/i.test(b.unit || '');
        if (aIsWeighted && !bIsWeighted) return -1;
        if (!aIsWeighted && bIsWeighted) return 1;
        return 0;
      });

      const filtered = sorted.filter((p) => {
        if (!q) return true;
        return (
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.plu_code || '').toLowerCase().includes(q) ||
          String(p.barcode || '').toLowerCase().includes(q)
        );
      });

      if (!filtered.length) {
        sel.innerHTML = '<option value="">لا توجد سلعة مطابقة...</option>';
        return;
      }

      sel.innerHTML = filtered.slice(0, 120).map((p) => {
        const price = Number(p.selling_price ?? p.price ?? 0).toFixed(2);
        const unit = p.unit || 'كغ';
        const pluTag = p.plu_code ? ` [PLU: ${p.plu_code}]` : '';
        return `<option value="${p.id}">${p.name}${pluTag} — (${price} د.ج / ${unit})</option>`;
      }).join('');

      this.selectedProductId = Number(sel.value || 0);
      this.recalcScaleLiveTotal();
    },

    onScaleProductChange(pid) {
      this.selectedProductId = Number(pid || 0);
      this.recalcScaleLiveTotal();
    },

    setWeightKg(valKg, updateManualInput = true) {
      const w = Math.max(0, parseFloat(valKg) || 0);
      this.currentWeightKg = Number(w.toFixed(3));

      const disp = document.getElementById('scaleModalWeightDisplay');
      const gramEl = document.getElementById('scaleModalGramHelper');
      const manInp = document.getElementById('scaleManualWeightInput');

      if (disp) disp.textContent = `${this.currentWeightKg.toFixed(3)} kg`;
      if (gramEl) {
        const grams = Math.round(this.currentWeightKg * 1000);
        gramEl.textContent = `⚖️ يعادل بالغرام: ${grams.toLocaleString('fr-DZ')} غرام`;
      }
      if (updateManualInput && manInp) {
        manInp.value = this.currentWeightKg.toFixed(3);
      }

      document.querySelectorAll('[data-wpreset]').forEach((btn) => {
        btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.wpreset) - this.currentWeightKg) < 0.002);
      });

      this.recalcScaleLiveTotal();
    },

    getSelectedProduct() {
      const pid = Number(document.getElementById('scaleModalProductSelect')?.value || this.selectedProductId || 0);
      return (window.AppState?.products || []).find((p) => Number(p.id) === pid) || null;
    },

    recalcScaleLiveTotal() {
      const prod = this.getSelectedProduct();
      const unitPrice = prod ? Number(prod.selling_price ?? prod.price ?? 0) : 0;
      const totalDzd = Number((this.currentWeightKg * unitPrice).toFixed(2));
      const centimes = Math.round(totalDzd * 100).toLocaleString('fr-DZ');

      const priceEl = document.getElementById('scaleModalComputedPriceDzd');
      const centEl = document.getElementById('scaleModalComputedCentimes');

      if (priceEl) priceEl.textContent = `${totalDzd.toFixed(2)} د.ج`;
      if (centEl) centEl.textContent = `🇩🇿 بالسنتيم: ${centimes} سنتيم`;
    },

    calcWeightFromMoneyDzd(amountDzd) {
      const targetDzd = parseFloat(amountDzd);
      const prod = this.getSelectedProduct();
      const unitPrice = prod ? Number(prod.selling_price ?? prod.price ?? 0) : 0;
      if (!Number.isFinite(targetDzd) || targetDzd <= 0 || unitPrice <= 0) return;

      const computedKg = Number((targetDzd / unitPrice).toFixed(3));
      this.setWeightKg(computedKg, true);
    },

    async sendScaleCommand(cmd) {
      try {
        if (cmd === 'zero') {
          await window.api?.scale?.zero?.();
          this.setWeightKg(0, true);
          if (window.showToast) window.showToast('✅ تم تصفير الميزان (0.000 kg)', 'info');
        } else if (cmd === 'tare') {
          await window.api?.scale?.tare?.();
          if (window.showToast) window.showToast('✅ تم تفعيل خصم وزن العلبة (Tare)', 'info');
        } else if (cmd === 'readOnce') {
          const res = await window.api?.scale?.readOnce?.();
          const w = res && typeof res === 'object' ? Number(res.weight || 0) : Number(res || 0);
          if (w > 0) {
            this.setWeightKg(w, true);
            if (window.showToast) window.showToast(`📡 تمت قراءة الوزن من الميزان: ${w.toFixed(3)} كغ`, 'success');
          } else {
            if (window.showToast) window.showToast('ℹ️ لم يتم رصد وزن من الكابل — يمكنك اختيار الوزن السريع أو كتابته يدوياً', 'info');
          }
        }
      } catch (_) {
        if (window.showToast) window.showToast('ℹ️ الميزان غير متصل بالكابل حالياً — استخدم الأزرار السريعة أو الإدخال اليدوي', 'info');
      }
    },

    confirmAddWeightedItemToCart() {
      const prod = this.getSelectedProduct();
      if (!prod) {
        if (window.showToast) window.showToast('⚠️ يرجى اختيار السلعة أولاً', 'warning');
        return;
      }
      if (this.currentWeightKg <= 0) {
        if (window.showToast) window.showToast('⚠️ يرجى تحديد وزن أكبر من 0.000 كغ', 'warning');
        return;
      }

      if (typeof window.App.addProductToCart === 'function') {
        window.App.addProductToCart(prod.id, this.currentWeightKg);
      } else if (typeof window.App.addToCart === 'function') {
        window.App.addToCart(prod.id, this.currentWeightKg);
      }

      const grams = Math.round(this.currentWeightKg * 1000);
      const totalDzd = (this.currentWeightKg * Number(prod.selling_price || 0)).toFixed(2);
      window.App.closeModal('posScaleModal');
      if (window.showToast) {
        window.showToast(`⚖️ تمت إضافة "${prod.name}" (${grams} غرام = ${totalDzd} د.ج) إلى السلة`, 'success');
      }
      window.GherbiV6Stage1?.restorePosKeyboardFocus?.();
    },

    // ========================================================================
    // 2. مفكك باركود ملصقات الميزان التلقائي (EAN-13 Scale Barcodes: 20 / 21 / 22)
    // ========================================================================
    decodeScaleBarcodeEan13(rawCode) {
      const code = String(rawCode || '').trim();
      // الباركود الموزون القياسي يتكون من 13 رقماً ويبدأ بـ 20 أو 21 أو 22
      if (!/^(20|21|22)\d{11}$/.test(code)) return null;

      const prefix = code.slice(0, 2);
      const pluRaw = code.slice(2, 7); // 5 أرقام لكود السلعة في الميزان (PLU)
      const valRaw = parseInt(code.slice(7, 12), 10) || 0; // 5 أرقام للوزن بالغرام أو السعر

      const products = window.AppState?.products || [];
      const pluNumber = parseInt(pluRaw, 10);

      const matchedProd = products.find((p) => {
        const pPlu = String(p.plu_code || '').trim();
        if (pPlu && (pPlu === pluRaw || parseInt(pPlu, 10) === pluNumber)) return true;
        if (String(p.barcode || '').trim() === pluRaw) return true;
        return false;
      });

      if (!matchedProd) return null;

      // في البادئة 20 و 21 القيمة هي الوزن بالغرام (مثلاً 00750 = 0.750 كغ)
      // وفي البادئة 22 القيمة هي المبلغ بالدينار فنتحول منه إلى الوزن
      let weightKg = Number((valRaw / 1000).toFixed(3));
      if (prefix === '22' && Number(matchedProd.selling_price) > 0) {
        weightKg = Number((valRaw / Number(matchedProd.selling_price)).toFixed(3));
      }

      return {
        product: matchedProd,
        weightKg: Math.max(0.001, weightKg),
        grams: Math.round(weightKg * 1000)
      };
    },

    hookEan13ScaleBarcodeDecoder() {
      const origScan = window.App.handleBarcodeScan?.bind(window.App);
      if (!origScan || window.App._v7ScaleBarcodeHooked) return;

      window.App.handleBarcodeScan = async function (rawCode) {
        const decoded = V7Scale.decodeScaleBarcodeEan13(rawCode);
        if (decoded && decoded.product) {
          const p = decoded.product;
          const w = decoded.weightKg;
          if (typeof window.App.addProductToCart === 'function') {
            window.App.addProductToCart(p.id, w);
          } else if (typeof window.App.addToCart === 'function') {
            window.App.addToCart(p.id, w);
          }
          const bcInp = document.getElementById('barcodeInput');
          if (bcInp) bcInp.value = '';
          if (window.showToast) {
            const totalDzd = (w * Number(p.selling_price || 0)).toFixed(2);
            window.showToast(`⚖️ باركود ميزان: "${p.name}" — الوزن: ${decoded.grams} غرام (${totalDzd} د.ج)`, 'success');
          }
          return;
        }
        return origScan(rawCode);
      };
      window.App._v7ScaleBarcodeHooked = true;
    }
  };

  window.GherbiV7Stage3 = V7Scale;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V7Scale.init());
  } else {
    V7Scale.init();
  }
})();
