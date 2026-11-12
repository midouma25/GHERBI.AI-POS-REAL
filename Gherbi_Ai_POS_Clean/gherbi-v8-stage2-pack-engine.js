/**
 * gherbi-v8-stage2-pack-engine.js (Pure Logic Edition — No Competing DOM Timers)
 * يوفر حسابات الباكي والكرتونة المخصصة (مثل غولد لاين #528: 8 حبات بـ 950 د.ج أو ×6 افتراضياً)
 * ويترك رسم أزرار السلة للمحرك الموحد V9Engine لمنع أي ارتعاش (Zero-Flicker).
 */

'use strict';

(function initGherbiV8Stage2PackEngine() {
  const PACK_STORAGE_KEY = 'gherbi_product_pack_configs_v8';

  const V8PackEngine = {
    init() {
      const wait = setInterval(() => {
        if (!window.App || !window.AppState) return;
        clearInterval(wait);
        this.ensureDefaultKnownConfigs();
        this.hookProductModalPackInputsAndLivePreview();
        this.overrideAllPackMethodsAndRecalc();
        console.log('✅ [Gherbi V8 Pack Engine]: جاهز (بدون مؤقتات DOM متضاربة).');
      }, 180);
    },

    getSavedPackMap() {
      try {
        const raw = localStorage.getItem(PACK_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (_) {
        return {};
      }
    },

    savePackConfig(productId, productName, config) {
      const map = this.getSavedPackMap();
      const cleanCfg = {
        packPrice: Math.max(0, Number(config.packPrice || 0)),
        packQty: Math.max(0, Number(config.packQty || 0)),
        packUnit: String(config.packUnit || 'كرتونة').trim() || 'كرتونة'
      };

      if (productId) map['ID_' + Number(productId)] = cleanCfg;
      if (productName) map['NAME_' + String(productName).trim().toLowerCase()] = cleanCfg;
      localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(map));

      const prods = window.AppState?.products || [];
      prods.forEach((p) => {
        if (
          (productId && Number(p.id) === Number(productId)) ||
          (productName && String(p.name || '').trim().toLowerCase() === String(productName).trim().toLowerCase())
        ) {
          p.wholesale_price = cleanCfg.packPrice;
          p.pack_price = cleanCfg.packPrice;
          p.wholesale_qty = cleanCfg.packQty;
          p.pack_qty = cleanCfg.packQty;
          p.wholesale_min_qty = cleanCfg.packQty;
          p.pack_factor = cleanCfg.packQty;
          p.wholesale_unit = cleanCfg.packUnit;
          p.pack_unit = cleanCfg.packUnit;
        }
      });
    },

    ensureDefaultKnownConfigs() {
      const map = this.getSavedPackMap();
      if (!map['ID_528']) {
        map['ID_528'] = { packPrice: 950, packQty: 8, packUnit: 'كرتونة' };
        map['NAME_غولد لاين (gold line)'] = { packPrice: 950, packQty: 8, packUnit: 'كرتونة' };
        localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(map));
      }

      const prods = window.AppState?.products || [];
      prods.forEach((p) => {
        const pid = Number(p.id);
        const pNameKey = 'NAME_' + String(p.name || '').trim().toLowerCase();
        const stored = map['ID_' + pid] || map[pNameKey];

        if (stored && (stored.packQty > 1 || stored.packPrice > 0)) {
          p.wholesale_price = stored.packPrice;
          p.pack_price = stored.packPrice;
          p.wholesale_qty = stored.packQty;
          p.pack_qty = stored.packQty;
          p.wholesale_min_qty = stored.packQty;
          p.pack_factor = stored.packQty;
          p.wholesale_unit = stored.packUnit || 'كرتونة';
        }
      });
    },

    resolvePackConfig(prod, item = null) {
      const map = this.getSavedPackMap();
      const pid = Number(prod?.id || item?.product_id || item?.productId || 0);
      const pName = String(prod?.name || item?.name || '').trim();
      const stored = (pid && map['ID_' + pid]) || (pName && map['NAME_' + pName.toLowerCase()]) || null;

      const unitRetailPrice = Number(
        item?._savedUnitPrice ??
        prod?.selling_price ??
        prod?.price ??
        item?.price ??
        0
      );

      const rawQty = Number(
        stored?.packQty ||
        prod?.pack_qty ||
        prod?.wholesale_qty ||
        prod?.wholesale_min_qty ||
        prod?.pack_factor ||
        0
      );

      const rawPrice = Number(
        stored?.packPrice ||
        prod?.wholesale_price ||
        prod?.pack_price ||
        0
      );

      const packUnitName = String(
        stored?.packUnit ||
        prod?.wholesale_unit ||
        prod?.pack_unit ||
        'كرتونة'
      ).trim() || 'كرتونة';

      const isConfigured = rawQty > 1 || rawPrice > 0;
      const packQty = rawQty > 1 ? rawQty : 6;

      let totalPackPriceDzd = Number((packQty * unitRetailPrice).toFixed(2));
      let unitPriceInsidePack = unitRetailPrice;

      if (rawPrice > 0) {
        if (rawPrice > unitRetailPrice) {
          totalPackPriceDzd = Number(rawPrice.toFixed(2));
          unitPriceInsidePack = Number((rawPrice / packQty).toFixed(4));
        } else {
          unitPriceInsidePack = rawPrice;
          totalPackPriceDzd = Number((packQty * rawPrice).toFixed(2));
        }
      }

      const regularTotalForSameQty = Number((packQty * unitRetailPrice).toFixed(2));
      const savingsPerPack = Math.max(0, Number((regularTotalForSameQty - totalPackPriceDzd).toFixed(2)));

      return {
        isConfigured,
        packQty,
        packUnitName,
        unitRetailPrice,
        totalPackPriceDzd,
        unitPriceInsidePack,
        savingsPerPack
      };
    },

    locateModalInputs() {
      const modal = document.getElementById('productModal');
      if (!modal) return {};

      let costInp = document.getElementById('prodCostInput');
      let sellInp = document.getElementById('prodPriceInput') || document.getElementById('prodSellInput');
      let packPriceInp = document.getElementById('prodWholesaleInput');
      let packUnitInp = document.getElementById('prodWholesaleUnitInput') || document.getElementById('prodPackUnitInput');
      let packQtyInp = document.getElementById('prodWholesaleQtyInput') ||
        document.getElementById('prodPackQtyInput') ||
        document.getElementById('prodWholesaleMinQtyInput');

      Array.from(modal.querySelectorAll('label')).forEach((lbl) => {
        const txt = (lbl.textContent || '').trim();
        const inp = lbl.parentElement?.querySelector('input');
        if (!inp) return;
        if (txt.includes('سعر البيع بالباكي') || txt.includes('سعر الجملة')) packPriceInp = inp;
        else if (txt.includes('pack_qty') || txt.includes('عدد الحبات داخل الباكي') || txt.includes('عدد القطع في الكرتونة')) packQtyInp = inp;
        else if (txt.includes('اسم العبوة') || txt.includes('اسم وحدة الجملة')) packUnitInp = inp;
        else if (txt.includes('سعر البيع (التجزئة)')) sellInp = inp;
        else if (txt.includes('سعر التكلفة')) costInp = inp;
      });

      return { modal, costInp, sellInp, packPriceInp, packUnitInp, packQtyInp };
    },

    hookProductModalPackInputsAndLivePreview() {
      const saveCurrentModalPackInputs = () => {
        const { modal, packPriceInp, packUnitInp, packQtyInp } = this.locateModalInputs();
        if (!modal || !modal.classList.contains('active')) return;

        let pid = document.getElementById('prodIdInput')?.value ||
          document.getElementById('prodEditId')?.value ||
          window.AppState?.editingProductId || '';

        if (!pid) {
          const headerText = modal.querySelector('h3')?.parentElement?.textContent || modal.textContent || '';
          const hashMatch = headerText.match(/#(\d+)/);
          if (hashMatch && hashMatch[1]) pid = hashMatch[1];
        }

        const pName = document.getElementById('prodNameInput')?.value?.trim() || '';
        const packPrice = parseFloat(packPriceInp?.value || '0') || 0;
        const packQty = parseFloat(packQtyInp?.value || '0') || 0;
        const packUnit = packUnitInp?.value?.trim() || 'كرتونة';

        if (pid || pName) {
          this.savePackConfig(pid, pName, { packPrice, packQty, packUnit });
        }
      };

      document.addEventListener(
        'input',
        (e) => {
          if (e.target && e.target.closest('#productModal')) saveCurrentModalPackInputs();
        },
        true
      );
      document.addEventListener(
        'click',
        (e) => {
          if (e.target && e.target.closest('#productModal')) setTimeout(saveCurrentModalPackInputs, 60);
        },
        true
      );
    },

    applyPackModeToRow(idx, packsCount = 1) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );

      const cfg = this.resolvePackConfig(prod, item);
      const count = Math.max(1, parseInt(packsCount, 10) || 1);

      if (!item._savedUnitPrice) item._savedUnitPrice = cfg.unitRetailPrice;

      item._isCartonPackMode = true;
      item._isWholesaleMode = true;
      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      item._packsCount = count;
      item._packQtyFactor = cfg.packQty;
      item._packUnitLabel = cfg.packUnitName;
      item._singlePackTotalDzd = cfg.totalPackPriceDzd;

      item.quantity = Number((count * cfg.packQty).toFixed(3));
      item.price = Number((cfg.totalPackPriceDzd / cfg.packQty).toFixed(4));
      item.custom_price = item.price;
      item.subtotal = Number((count * cfg.totalPackPriceDzd).toFixed(2));

      window.App.recalcAndRenderCart?.();
    },

    revertRowToSingleUnit(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;

      const prod = (window.AppState?.products || []).find(
        (p) => Number(p.id) === Number(item.product_id || item.productId) || p.name === item.name
      );
      const unitPrice = Number(item._savedUnitPrice || prod?.selling_price || prod?.price || 125);

      item._isCartonPackMode = false;
      item._isWholesaleMode = false;
      item._editedFromSubtotalBox = false;
      delete item._manualLineSubtotal;
      delete item._packsCount;
      delete item._singlePackTotalDzd;
      delete item.custom_price;

      item.quantity = 1;
      item.price = unitPrice;
      item.subtotal = Number(unitPrice.toFixed(2));

      window.App.recalcAndRenderCart?.();
    },

    togglePackOnRow(idx) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;
      if (!item._isCartonPackMode) this.applyPackModeToRow(idx, 1);
      else this.revertRowToSingleUnit(idx);
    },

    stepPacksOnRow(idx, delta) {
      const items = window.App?.currentCart?.items || [];
      const item = items[idx];
      if (!item) return;
      const nextCount = Number(item._packsCount || 1) + delta;
      if (nextCount <= 0) this.revertRowToSingleUnit(idx);
      else this.applyPackModeToRow(idx, nextCount);
    },

    overrideAllPackMethodsAndRecalc() {
      const toggleFn = (idx) => this.togglePackOnRow(idx);
      if (window.App) {
        window.App.toggleCartItemWholesaleUnit = toggleFn;
        window.App.openUnitChoiceModal = toggleFn;
        window.App.openPosUnitChoiceModal = toggleFn;
      }

      if (window.App && typeof window.App.recalcCart === 'function' && !window.App._v8ExactPackRecalcWrapped) {
        const origRecalc = window.App.recalcCart.bind(window.App);
        window.App.recalcCart = function (...args) {
          const cart = window.App?.currentCart;
          if (cart && Array.isArray(cart.items)) {
            cart.items.forEach((it) => {
              const qty = Number(it.quantity || 1);
              const price = Number(it.price || 0);

              if (it._isCartonPackMode && it._packQtyFactor) {
                const expectedUnitFromPack = Number(((it._singlePackTotalDzd || 0) / it._packQtyFactor).toFixed(4));
                if (Math.abs(price - expectedUnitFromPack) > 0.02 && !it._editedFromSubtotalBox) {
                  it._singlePackTotalDzd = Number((price * it._packQtyFactor).toFixed(2));
                  it.subtotal = Number((qty * price).toFixed(2));
                } else if (it._editedFromSubtotalBox && it._manualLineSubtotal !== undefined) {
                  it.subtotal = Number(it._manualLineSubtotal.toFixed(2));
                } else {
                  const ratio = qty / Number(it._packQtyFactor);
                  if (Math.abs(ratio - Math.round(ratio)) < 0.01 && Math.round(ratio) >= 1) {
                    it._packsCount = Math.round(ratio);
                    it.subtotal = Number((it._packsCount * it._singlePackTotalDzd).toFixed(2));
                  } else {
                    it.subtotal = Number((qty * price).toFixed(2));
                  }
                }
              } else if (it._editedFromSubtotalBox && it._manualLineSubtotal !== undefined) {
                it.subtotal = Number(it._manualLineSubtotal.toFixed(2));
              }
            });
          }

          const res = origRecalc(...args);

          if (cart && Array.isArray(cart.items)) {
            let exactSub = 0;
            cart.items.forEach((it) => {
              if (it._editedFromSubtotalBox && it._manualLineSubtotal !== undefined) {
                it.subtotal = Number(it._manualLineSubtotal.toFixed(2));
              } else if (it._isCartonPackMode && it._singlePackTotalDzd && it._packsCount) {
                const ratio = Number(it.quantity || 0) / Number(it._packQtyFactor || 1);
                if (Math.abs(ratio - it._packsCount) < 0.01) {
                  it.subtotal = Number((it._packsCount * it._singlePackTotalDzd).toFixed(2));
                }
              }
              exactSub += Number(it.subtotal || 0);
            });
            if (res && typeof res === 'object') {
              const disc = Number(cart.discount || 0) + Number(cart.couponDiscount || 0);
              res.subtotal = Number(exactSub.toFixed(2));
              res.total = Math.max(0, Number((exactSub - disc).toFixed(2)));
            }
          }
          return res;
        };
        window.App._v8ExactPackRecalcWrapped = true;
      }
    }
  };

  window.GherbiV8PackEngine = V8PackEngine;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => V8PackEngine.init());
  } else {
    V8PackEngine.init();
  }
})();
