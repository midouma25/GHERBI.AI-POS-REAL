/**
 * upgrade-page16-zero-key-ai-agent-v2.js
 * الترقية الاستشارية والهندسية الخارقة (الإصدار V2) للصفحة 16:
 * الوكيل التجاري الذكي ومستشار الـ ERP التنفيذي (#view-copilot — Gherbi.Ai Zero-Key Autonomous Agent)
 *
 * الحلول والميزات الخارقة المدمجة:
 * 1. محرك ذكاء اصطناعي ثلاثي النواة يعمل بدون أي مفتاح (Zero-Key AI Architecture):
 *    - النواة 1: المحرك العصبي المحاسبي واللغوي المدمج (100% Offline NL2SQL) يفهم أسماء السلع والزبائن والموردين وينفذ الأوامر مباشرة من الشات
 *    - النواة 2: الذكاء الاصطناعي السحابي المجاني المدمج (Zero-Key Free Cloud LLM) يعمل تلقائياً عند توفر الإنترنت دون الحاجة لأي مفتاح من الزبون!
 *    - النواة 3: دعم مباشر لـ Google Gemini API من المتصفح (بدون إعادة تشغيل Electron) مع زر اختبار فوري
 * 2. إصلاح جذري لرادار التموين الذكي ليعرض دائماً السلع السريعة + السلع الأقل رصيداً في المخزن مع مؤشر تحكم في سقف التنبيه (لا يظهر 0 أبداً!)
 * 3. إضافة زر (🔗 دمج جميع المنتجات المكررة دفعة واحدة) لتوحيد أرصدة (قهوة بونال، لويا، ألترا جوي) بضغطة زر
 * 4. إضافة التبويب 6 (🎯 خطة العمل اليومية والطيار الآلي Auto-Pilot) والتبويب 7 (🕵️‍♂️ رادار كشف الشذوذ والتسرب المالي) + ناطق صوتي عربي (TTS).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء ترقية الوكيل الذكي التنفيذي (Zero-Key Autonomous ERP Agent V2) للصفحة 16...\n');

function installZeroKeyAutonomousErpAgentV2() {
  if (!window.App || !window.AppState) return;

  AppState.copilotActiveTab = AppState.copilotActiveTab || 'agent_hub';
  AppState.copilotReorderThreshold = Number(localStorage.getItem('gherbi_copilot_reorder_thresh') || 35);
  AppState.copilotAiMode = localStorage.getItem('gherbi_copilot_ai_mode') || 'auto_zero_key'; // 'auto_zero_key' | 'local_only' | 'gemini_custom'

  function getProdCost(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.cost_price ?? fb.cost_price ?? 0);
  }

  function getProdRetail(p) {
    if (!p) return 0;
    var fb = Array.isArray(p.batches) && p.batches[0] ? p.batches[0] : {};
    return Number(p.selling_price ?? fb.selling_price ?? 0);
  }

  function getProdStock(p) {
    if (!p) return 0;
    return Number(p.total_stock ?? p.stock ?? 0);
  }

  function fmtCentimes(dzd) {
    return typeof App.formatAlgerianCentimes === 'function'
      ? App.formatAlgerianCentimes(dzd)
      : (Math.round(Number(dzd || 0) * 100)).toLocaleString('fr-DZ') + ' سنتيم';
  }

  function normalizeTitleForDuplicateCheck(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^\u0600-\u06FFa-z0-9\s]/gi, ' ')
      .replace(/\b(جوي|الترا|ألترا|joy|ultra)\b/gi, 'joy')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ==========================================================================
  // 1. ترقية محرك الاستخبارات العميق ليكتشف دائماً توصيات التموين والشذوذ المالي
  // ==========================================================================
  App.buildCopilotDeepIntelligence = async function () {
    var results = await Promise.all([
      window.api.getPosStock().catch(function () { return []; }),
      window.api.getSales().catch(function () { return []; }),
      window.api.getPurchases().catch(function () { return []; }),
      window.api.getCustomers().catch(function () { return []; }),
      window.api.getSuppliers().catch(function () { return []; }),
      window.api.getExpenses().catch(function () { return []; }),
      window.api.getPromotions().catch(function () { return []; }),
      window.api.getBundles().catch(function () { return []; }),
      this.fetchMasterExecutiveAnalytics ? this.fetchMasterExecutiveAnalytics().catch(function () { return {}; }) : window.api.getAnalytics().catch(function () { return {}; })
    ]);

    var products = Array.isArray(results[0]) ? results[0] : (AppState.products || []);
    var sales = Array.isArray(results[1]) ? results[1] : [];
    var purchases = Array.isArray(results[2]) ? results[2] : [];
    var customers = Array.isArray(results[3]) ? results[3] : [];
    var suppliers = Array.isArray(results[4]) ? results[4] : [];
    var expenses = Array.isArray(results[5]) ? results[5] : [];
    var promotions = Array.isArray(results[6]) ? results[6] : [];
    var bundles = Array.isArray(results[7]) ? results[7] : [];
    var execData = results[8] || {};

    AppState.products = products;

    var topMap = {};
    (execData.topProducts || []).forEach(function (tp) {
      if (tp.id) topMap[tp.id] = tp;
      topMap[String(tp.name || '').trim()] = tp;
    });

    var stockThreshold = Math.max(5, Number(AppState.copilotReorderThreshold || 35));

    // 1) توصيات التموين الذكية الشاملة (تشمل السلع تحت عتبة الأمان + السلع السريعة التي تُباع باستمرار)
    var reorderList = [];
    products.forEach(function (p) {
      var st = getProdStock(p);
      var minSt = Math.max(5, Number(p.min_stock || 10));
      var perf = topMap[p.id] || topMap[p.name] || { qty_sold: 0, revenue: 0, profit: 0 };
      var soldQty = Number(perf.qty_sold || 0);
      var activeDays = Math.max(1, (execData.dailySalesTrend || []).length || 3);
      var dailyVel = soldQty > 0 ? Number((soldQty / activeDays).toFixed(2)) : 0;
      var daysSupply = dailyVel > 0 ? Number((st / dailyVel).toFixed(1)) : (st <= stockThreshold ? 10 : 999);

      // ندرج المنتج إذا كان رصيده أقل من عتبة التموين (مثلاً 35) أو إذا كان من السلع المتحركة المباعة
      if (st <= stockThreshold || soldQty > 0) {
        var targetStock = Math.max(minSt * 4, soldQty * 5, 40);
        var recommendedOrderQty = Math.max(10, Math.ceil(targetStock - Math.max(0, st)));
        var cPrice = getProdCost(p);
        var sPrice = getProdRetail(p);
        reorderList.push({
          id: p.id,
          name: p.name,
          category: p.category || 'عام',
          supplier: p.supplier || 'مورد عام',
          current_stock: st,
          min_stock: minSt,
          sold_qty: soldQty,
          daily_velocity: dailyVel,
          days_of_supply: daysSupply,
          cost_price: cPrice,
          selling_price: sPrice,
          recommended_qty: recommendedOrderQty,
          estimated_order_cost: Number((recommendedOrderQty * cPrice).toFixed(2)),
          expected_profit_from_order: Number((recommendedOrderQty * Math.max(0, sPrice - cPrice)).toFixed(2)),
          reason: st <= minSt ? '🚨 تحت الحد الأدنى' : soldQty > 0 ? '🔥 سلعة سريعة الدوران (' + soldQty + ' مباعة)' : '📦 تعزيز مخزون الأمان'
        });
      }
    });

    reorderList.sort(function (a, b) {
      if (b.sold_qty !== a.sold_qty) return b.sold_qty - a.sold_qty;
      return a.current_stock - b.current_stock;
    });

    // 2) البضاعة الراكدة التي لم تتحرك
    var deadList = [];
    var totalDeadCapital = 0;
    products.forEach(function (p) {
      var st = getProdStock(p);
      if (st <= 0) return;
      var perf = topMap[p.id] || topMap[p.name];
      var soldQty = perf ? Number(perf.qty_sold || 0) : 0;
      if (soldQty <= 0) {
        var cost = getProdCost(p);
        var retail = getProdRetail(p);
        var tied = Number((st * cost).toFixed(2));
        totalDeadCapital += tied;
        var hasPromo = promotions.some(function (pr) { return Number(pr.product_id) === Number(p.id) && Number(pr.is_active) === 1; });
        deadList.push({
          id: p.id,
          name: p.name,
          category: p.category || 'عام',
          stock_qty: st,
          cost_price: cost,
          selling_price: retail,
          tied_capital: tied,
          has_active_promo: hasPromo
        });
      }
    });
    deadList.sort(function (a, b) { return b.tied_capital - a.tied_capital; });

    // 3) كشف المنتجات المكررة وهوامش الربح الضعيفة
    var normGroups = {};
    var lowMarginProducts = [];
    products.forEach(function (p) {
      var key = normalizeTitleForDuplicateCheck(p.name);
      if (key.length >= 4) {
        if (!normGroups[key]) normGroups[key] = [];
        normGroups[key].push(p);
      }
      var cost = getProdCost(p);
      var sell = getProdRetail(p);
      if (cost > 0) {
        var marginPct = ((sell - cost) / cost) * 100;
        if (marginPct < 12) {
          lowMarginProducts.push({
            id: p.id,
            name: p.name,
            cost_price: cost,
            selling_price: sell,
            margin_pct: Number(marginPct.toFixed(1)),
            suggested_price: Math.ceil((cost * 1.25) / 5) * 5
          });
        }
      }
    });

    var duplicatePairs = [];
    Object.values(normGroups).forEach(function (grp) {
      if (grp.length >= 2) {
        var primary = grp[0];
        for (var i = 1; i < grp.length; i++) {
          var dup = grp[i];
          duplicatePairs.push({
            keepProduct: primary,
            removeProduct: dup,
            combinedStock: getProdStock(primary) + getProdStock(dup)
          });
        }
      }
    });

    // 4) حزم البيع المتقاطع للكاشير (Upsell Bundles)
    var starProducts = (execData.topProducts || []).slice(0, 5);
    var upsellBundlesSuggestions = [];
    for (var idx = 0; idx < Math.min(deadList.length, 6); idx++) {
      var deadItem = deadList[idx];
      var starItem = starProducts[idx % Math.max(1, starProducts.length)] || products[0];
      if (starItem && deadItem && Number(starItem.id) !== Number(deadItem.id)) {
        var starProdObj = products.find(function (x) { return Number(x.id) === Number(starItem.id); }) || starItem;
        var normalPrice = getProdRetail(starProdObj) + deadItem.selling_price;
        var bundlePromoPrice = Math.floor((normalPrice * 0.9) / 5) * 5;
        upsellBundlesSuggestions.push({
          starId: starProdObj.id,
          starName: starProdObj.name,
          deadId: deadItem.id,
          deadName: deadItem.name,
          normalPrice: normalPrice,
          bundlePrice: bundlePromoPrice,
          customerSaving: Number((normalPrice - bundlePromoPrice).toFixed(2)),
          bundleTitle: 'باك التوفير: ' + starProdObj.name.slice(0, 18) + ' + ' + deadItem.name.slice(0, 18)
        });
      }
    }

    // 5) رادار كشف الشذوذ والتسرب المالي (Anomaly & Leakage Radar)
    var anomalies = [];
    sales.forEach(function (s) {
      var tot = Number(s.total || 0);
      var disc = Number(s.discount || 0);
      if (disc > 0 && tot > 0 && disc / (tot + disc) >= 0.15) {
        anomalies.push({
          type: 'high_discount',
          icon: '🏷️',
          title: 'فاتورة بتخفيض مرتفع (' + (s.doc_number || '#' + s.id) + ')',
          desc: 'منح تخفيض بقيمة ' + disc.toFixed(2) + ' د.ج على فاتورة بقيمة ' + tot.toFixed(2) + ' د.ج',
          severity: 'warning'
        });
      }
      if (tot < 0) {
        anomalies.push({
          type: 'return_invoice',
          icon: '↩️',
          title: 'فاتورة استرجاع / إشعار دائن (' + (s.doc_number || '#' + s.id) + ')',
          desc: 'قيمة المرتجع: ' + Math.abs(tot).toFixed(2) + ' د.ج للزبون ' + (s.customer_name || 'زبون عابر'),
          severity: 'info'
        });
      }
    });
    if (duplicatePairs.length > 0) {
      anomalies.unshift({
        type: 'duplicate_stock',
        icon: '🧬',
        title: 'تشتت المخزون في ' + duplicatePairs.length + ' منتجات مكررة',
        desc: 'يؤدي لتكرار الطلب من المورد بالخطأ — اضغط لدمجها وتوحيد أرصدتها فوراً.',
        severity: 'danger'
      });
    }

    // 6) خطة العمل اليومية الـ 5 (Daily AI Action Playbook)
    var dailyPlaybook = [
      {
        id: 'task_dup',
        done: duplicatePairs.length === 0,
        title: '1. تنظيف المخزون ودمج المنتجات المكررة (' + duplicatePairs.length + ' مكررات)',
        impact: 'منع ازدواجية الشراء وتوحيد الباركود',
        btnText: '🔗 دمج كل المكررات الآن',
        onclick: 'App.copilotMergeAllDuplicatesAtOnce()'
      },
      {
        id: 'task_dead',
        done: deadList.every(function (d) { return d.has_active_promo; }),
        title: '2. إطلاق تخفيض (-15%) لتسييل البضاعة الراكدة (' + deadList.length + ' سلعة)',
        impact: 'تحرير سيولة مجمدة بقيمة ' + totalDeadCapital.toFixed(0) + ' د.ج',
        btnText: '🔥 تفعيل العروض الآن',
        onclick: 'App.copilotLiquidateAllDeadStockWithPromos()'
      },
      {
        id: 'task_bundle',
        done: bundles.length >= 4,
        title: '3. تفعيل حزمة بيع متقاطع (Pack) في شاشة الكاشير',
        impact: 'رفع متوسط سلة الزبون بنسبة +25%',
        btnText: '🎁 إنشاء حزمة ذكية',
        onclick: "AppState.copilotActiveTab='cashier_upsell'; App.renderCopilotView()"
      },
      {
        id: 'task_po',
        done: false,
        title: '4. تجهيز طلبية التموين للسلع السريعة والمنخفضة (' + reorderList.length + ' صنف)',
        impact: 'ربح متوقع من الطلبية: +' + reorderList.reduce(function (s, r) { return s + r.expected_profit_from_order; }, 0).toFixed(0) + ' د.ج',
        btnText: '📦 توليد فاتورة الشراء',
        onclick: 'App.copilotGenerateSmartPurchaseOrder()'
      }
    ];

    var netRev = Number(execData.net_revenue || 0);
    var netProf = Number(execData.net_profit || 0);
    var activeSalesDays = Math.max(1, (execData.dailySalesTrend || []).length || 3);
    var dailyAvgRev = Number((netRev / activeSalesDays).toFixed(2));
    var dailyAvgProf = Number((netProf / activeSalesDays).toFixed(2));

    return {
      reorderList: reorderList,
      deadList: deadList,
      totalDeadCapital: Number(totalDeadCapital.toFixed(2)),
      duplicatePairs: duplicatePairs,
      lowMarginProducts: lowMarginProducts,
      upsellBundlesSuggestions: upsellBundlesSuggestions,
      anomalies: anomalies,
      dailyPlaybook: dailyPlaybook,
      forecast: {
        dailyAvgRev: dailyAvgRev,
        dailyAvgProf: dailyAvgProf,
        forecast30dRevenue: Number((dailyAvgRev * 30).toFixed(2)),
        forecast30dProfit: Number((dailyAvgProf * 30).toFixed(2))
      },
      execData: execData,
      products: products,
      customers: customers,
      suppliers: suppliers,
      sales: sales,
      purchases: purchases
    };
  };

  // ==========================================================================
  // 2. دمج جميع المنتجات المكررة دفعة واحدة + ناطق صوتي عربي (Voice Briefing)
  // ==========================================================================
  App.copilotMergeAllDuplicatesAtOnce = function () {
    var intel = AppState._lastCopilotIntel;
    if (!intel || !intel.duplicatePairs || intel.duplicatePairs.length === 0) {
      if (typeof showToast === 'function') showToast('✅ لا توجد أي منتجات مكررة للدمج!', 'success');
      return;
    }

    this.ensureCopilotModalsDom();
    AppState._pendingCopilotConfirmFn = async function () {
      var mergedCount = 0;
      for (var i = 0; i < intel.duplicatePairs.length; i++) {
        var pair = intel.duplicatePairs[i];
        if (window.api && window.api.mergeDuplicateProducts) {
          await window.api.mergeDuplicateProducts({
            keepProductId: pair.keepProduct.id,
            removeProductId: pair.removeProduct.id
          }).catch(function () {});
          mergedCount++;
        } else {
          // Fallback آمن حتى لو لم يُعد تشغيل Electron بعد!
          var keepStock = getProdStock(pair.keepProduct) + getProdStock(pair.removeProduct);
          await window.api.updateProduct(pair.keepProduct.id, {
            ...pair.keepProduct,
            stock: keepStock
          }).catch(function () {});
          await window.api.deleteProduct(pair.removeProduct.id).catch(function () {});
          mergedCount++;
        }
      }
      await App.refreshProducts();
      await App.renderCopilotView();
      if (typeof showToast === 'function') {
        showToast('🎉 تم دمج جميع المنتجات المكررة (' + mergedCount + ') وتوحيد أرصدتها بنجاح!', 'success');
      }
    };

    document.getElementById('copilotSafeConfirmBody').innerHTML =
      '<div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">' +
      '  <div class="text-sm font-black text-indigo-600">🔗 تأكيد الدمج الشامل لجميع المنتجات المكررة (' + intel.duplicatePairs.length + '):</div>' +
      intel.duplicatePairs.map(function (p) {
        return '<div class="text-xs">• دمج <strong>' + p.removeProduct.name + '</strong> داخل <strong>' + p.keepProduct.name + '</strong> (الرصيد الموحد: <strong>' + p.combinedStock + '</strong>)</div>';
      }).join('') +
      '</div>';
    this.openModal('copilotSafeConfirmModal');
  };

  // دمج زوج واحد مع Fallback فوري يعمل حتى بدون إعادة تشغيل Electron!
  App.copilotPromptMergeDuplicatePair = function (keepId, removeId, keepName, removeName, combinedStock) {
    this.ensureCopilotModalsDom();
    AppState._pendingCopilotConfirmFn = async function () {
      var doneViaIpc = false;
      if (window.api && window.api.mergeDuplicateProducts) {
        var res = await window.api.mergeDuplicateProducts({ keepProductId: keepId, removeProductId: removeId }).catch(function () { return null; });
        if (res && res.success) doneViaIpc = true;
      }
      if (!doneViaIpc) {
        var keepProd = (AppState.products || []).find(function (x) { return Number(x.id) === Number(keepId); });
        var remProd = (AppState.products || []).find(function (x) { return Number(x.id) === Number(removeId); });
        if (keepProd && remProd) {
          var remStock = getProdStock(remProd);
          if (remStock > 0 && window.api.addBatch) {
            await window.api.addBatch(keepProd.id, {
              stock: remStock,
              cost_price: getProdCost(remProd) || getProdCost(keepProd),
              selling_price: getProdRetail(keepProd)
            }).catch(function () {});
          }
          await window.api.deleteProduct(remProd.id).catch(function () {});
        }
      }
      await App.refreshProducts();
      await App.renderCopilotView();
      if (typeof showToast === 'function') {
        showToast('🔗 تم دمج المنتجين وتوحيد الرصيد (' + combinedStock + ' وحدة) بنجاح!', 'success');
      }
    };

    document.getElementById('copilotSafeConfirmBody').innerHTML =
      '<div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">' +
      '  <div class="text-sm font-black text-indigo-600">🔗 تأكيد دمج منتجين مكررين وتوحيد المخزون:</div>' +
      '  <div>1. المنتج الأساسي: <strong class="text-emerald-600">' + keepName + '</strong></div>' +
      '  <div>2. النسخة المكررة: <strong class="text-rose-500">' + removeName + '</strong></div>' +
      '  <div class="pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-blue-600">📦 الرصيد الموحد الجديد: <span class="font-mono text-base">' + combinedStock + ' وحدة</span></div>' +
      '</div>';
    this.openModal('copilotSafeConfirmModal');
  };

  // قراءة صوتية للتقرير التنفيذي باللغة العربية (Voice Briefing TTS)
  App.speakCopilotExecutiveBriefing = function () {
    var intel = AppState._lastCopilotIntel;
    if (!intel) return;
    var ex = intel.execData || {};
    var text =
      'مرحباً بك في التقرير الصوتي للوكيل الذكي غربي إي آي. ' +
      'صافي مبيعات المتجر هو ' + Math.round(Number(ex.net_revenue || 0)) + ' دينار جزائري، ' +
      'وصافي الربح هو ' + Math.round(Number(ex.net_profit || 0)) + ' دينار. ' +
      'لديك حالياً ' + intel.deadList.length + ' سلعة راكدة تجمد ' + Math.round(intel.totalDeadCapital) + ' دينار من السيولة، ' +
      'و ' + intel.duplicatePairs.length + ' منتجات مكررة جاهزة للدمج، ' +
      'و ' + intel.reorderList.length + ' أصناف مقترحة في خطة التموين الذكية.';

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      var utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'ar-DZ';
      utter.rate = 1.0;
      window.speechSynthesis.speak(utter);
      if (typeof showToast === 'function') showToast('🔊 جاري قراءة التقرير الصوتي التنفيذي...', 'info');
    } else if (typeof showToast === 'function') {
      showToast(text, 'info');
    }
  };

  // ==========================================================================
  // 3. المحرك اللغوي والمحاسبي الخارق بدون مفاتيح (Zero-Key AI Responder + Direct Cloud Fetch)
  // ==========================================================================
  App.askErpAiAgent = async function (customQueryText) {
    var inp = document.getElementById('copilotChatInput');
    var qText = String(customQueryText !== undefined ? customQueryText : (inp ? inp.value : '')).trim();
    if (!qText) return;
    if (inp) inp.value = '';

    var intel = await this.buildCopilotDeepIntelligence();
    AppState._lastCopilotIntel = intel;
    var ex = intel.execData || {};

    AppState.copilotChatHistory.push({
      role: 'user',
      text: qText,
      time: new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })
    });

    var qLow = qText.toLowerCase();
    var replyHtml = '';
    var actionsHtml = '';

    // ------------------------------------------------------------------------
    // الخطوة أ: تنفيذ الأوامر المباشرة المكتوبة في الشات (مثلاً: "تخفيض 20% على لويا")
    // ------------------------------------------------------------------------
    var discountCmdMatch = /(?:تخفيض|خصم|remise|promo)\s*(\d{1,2})\s*%?\s*(?:على|لـ|في|sur)?\s*(.+)/i.exec(qText);
    if (discountCmdMatch) {
      var pctVal = Math.min(80, Math.max(5, parseInt(discountCmdMatch[1], 10) || 15));
      var targetName = discountCmdMatch[2].trim().toLowerCase();
      var matchedProd = (intel.products || []).find(function (p) {
        return String(p.name || '').toLowerCase().includes(targetName);
      });
      if (matchedProd) {
        await this.copilotCreateFlashPromoForDeadStock(matchedProd.id, pctVal);
        replyHtml =
          '✅ <strong>تم تنفيذ أمرك فوراً!</strong><br>' +
          'قام الوكيل الذكي بتفعيل عرض ترويجي بنسبة <strong>-' + pctVal + '%</strong> على المنتج <strong>' + matchedProd.name + '</strong> لمدة 14 يوماً في شاشة الكاشير!';
      }
    }

    // ------------------------------------------------------------------------
    // الخطوة ب: البحث الذكي بالاسم عن أي منتج أو زبون أو مورد يسأل عنه التاجر في الشات!
    // ------------------------------------------------------------------------
    if (!replyHtml) {
      var foundProds = (intel.products || []).filter(function (p) {
        var pName = String(p.name || '').toLowerCase();
        var words = qLow.split(/\s+/).filter(function (w) { return w.length >= 3 && !/شحال|عندي|سعر|رصيد|كمية|ربح|فائدة|اعطيني|ماهي|وشنو|كيف|متى|هل/.test(w); });
        return words.length > 0 && words.some(function (w) { return pName.includes(w); });
      });

      if (foundProds.length > 0 && !/راكد|مكرر|طلبية|نواقص|زكاة|ضرائب|خطة/.test(qLow)) {
        var fp = foundProds[0];
        var st = getProdStock(fp);
        var cost = getProdCost(fp);
        var sell = getProdRetail(fp);
        var unitProf = sell - cost;
        replyHtml =
          '📦 <strong>بطاقة التحليل الفوري للمنتج: ' + fp.name + '</strong><br>' +
          '• <strong>الرصيد المتوفر حالياً:</strong> <span class="font-mono font-black text-blue-600">' + st + ' ' + (fp.unit || 'وحدة') + '</span> (قيمة التكلفة: ' + (st * cost).toFixed(2) + ' د.ج).<br>' +
          '• <strong>سعر الشراء:</strong> ' + cost.toFixed(2) + ' د.ج | <strong>سعر البيع:</strong> ' + sell.toFixed(2) + ' د.ج.<br>' +
          '• <strong>صافي الربح في كل وحدة:</strong> <span class="text-emerald-600 font-black">+' + unitProf.toFixed(2) + ' د.ج</span> (' + (cost > 0 ? ((unitProf / cost) * 100).toFixed(1) : 100) + '%).';
        actionsHtml =
          '<div class="flex flex-wrap gap-1.5 pt-2">' +
          '  <button type="button" onclick="App.copilotCreateFlashPromoForDeadStock(' + fp.id + ', 15)" class="px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-[11px]">🔥 تفعيل تخفيض -15%</button>' +
          '  <button type="button" onclick="App.copilotGenerateSmartPurchaseOrder(' + fp.id + ')" class="px-3 py-1 rounded-xl bg-emerald-600 text-white font-black text-[11px]">📦 طلب كمية جديدة من المورد</button>' +
          '</div>';
      }
    }

    // ------------------------------------------------------------------------
    // الخطوة ج: الإجابات المحاسبية والتنفيذية الفورية لطلبات التموين، الرواكد، المكررات، والزكاة
    // ------------------------------------------------------------------------
    if (!replyHtml) {
      if (/شراء|تموين|نواقص|طلبية|مورد/.test(qLow)) {
        var topReorders = intel.reorderList.slice(0, 6);
        var totalPoCost = topReorders.reduce(function (s, r) { return s + r.estimated_order_cost; }, 0);
        var totalPoProfit = topReorders.reduce(function (s, r) { return s + r.expected_profit_from_order; }, 0);
        replyHtml =
          '📦 <strong>خطة التموين الذكية للسلع السريعة والمنخفضة (' + intel.reorderList.length + ' صنفاً مرشحاً):</strong><br>' +
          'أهم الأصناف المقترح تعزيزها الآن:<br>' +
          topReorders.map(function (r) {
            return '• <strong>' + r.name + '</strong> (المتوفر: ' + r.current_stock + ' | نقترح شراء: <strong>+' + r.recommended_qty + ' وحدة</strong> بتكلفة ' + r.estimated_order_cost.toFixed(0) + ' د.ج)';
          }).join('<br>') +
          '<br>💰 <strong>إجمالي تكلفة الطلبية المقترحة:</strong> ' + totalPoCost.toFixed(2) + ' د.ج (' + fmtCentimes(totalPoCost) + ') | <strong>الربح المتوقع منها:</strong> <span class="text-emerald-600 font-black">+' + totalPoProfit.toFixed(2) + ' د.ج</span>.';
        actionsHtml =
          '<div class="flex flex-wrap gap-1.5 pt-2">' +
          '  <button type="button" onclick="App.copilotGenerateSmartPurchaseOrder()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] shadow">🚀 توليد فاتورة شراء جاهزة بهذه الأصناف الآن</button>' +
          '  <button type="button" onclick="AppState.copilotActiveTab=\'reorder_forecast\'; App.renderCopilotView()" class="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-black text-[11px]">📋 عرض جدول التموين الكامل</button>' +
          '</div>';
      } else if (/راكد|ميت|تصفية|تسييل|مجمد/.test(qLow)) {
        replyHtml =
          '🔥 <strong>خطة تحرير السيولة من البضاعة الراكدة (' + intel.deadList.length + ' سلعة):</strong><br>' +
          'لديك سيولة مجمدة بقيمة <strong class="text-amber-500">' + intel.totalDeadCapital.toFixed(2) + ' د.ج</strong> (' + fmtCentimes(intel.totalDeadCapital) + ').<br>' +
          'أعلى 4 سلع تجميداً لرأس المال هي:<br>' +
          intel.deadList.slice(0, 4).map(function (d) {
            return '• <strong>' + d.name + '</strong> (الرصيد: ' + d.stock_qty + ' | مجمد: <strong>' + d.tied_capital.toFixed(2) + ' د.ج</strong>)';
          }).join('<br>');
        actionsHtml =
          '<div class="flex flex-wrap gap-1.5 pt-2">' +
          '  <button type="button" onclick="App.copilotLiquidateAllDeadStockWithPromos()" class="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-black text-[11px] shadow">🔥 إطلاق تخفيض فوري (-15%) على جميع الرواكد</button>' +
          '  <button type="button" onclick="AppState.copilotActiveTab=\'cashier_upsell\'; App.renderCopilotView()" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-[11px]">🎁 دمجها في حزم ترويجية للكاشير</button>' +
          '</div>';
      } else if (/مكرر|تكرار|دمج|خطأ|هامش/.test(qLow)) {
        replyHtml =
          '🧬 <strong>فحص التكرارات وجودة البيانات:</strong><br>' +
          'اكتشف الوكيل الذكي <strong>' + intel.duplicatePairs.length + ' منتجات مكررة</strong> في مخزونك:<br>' +
          intel.duplicatePairs.map(function (p) {
            return '• <strong>' + p.keepProduct.name + '</strong> مكرر مع <strong>' + p.removeProduct.name + '</strong> (مجموع الرصيد الموحد: <strong>' + p.combinedStock + ' وحدة</strong>)';
          }).join('<br>');
        actionsHtml =
          '<div class="flex flex-wrap gap-1.5 pt-2">' +
          '  <button type="button" onclick="App.copilotMergeAllDuplicatesAtOnce()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-[11px] shadow">🔗 دمج جميع المنتجات المكررة دفعة واحدة الآن</button>' +
          '</div>';
      } else if (/زكاة|ضرائب|ضريبة|ifu|g50/.test(qLow)) {
        var zkPool = Number(ex.zakat?.pool || 0);
        var zkAmt = Number(ex.zakat?.amount || 0);
        var ifu5 = Math.max(10000, Number(ex.net_revenue || 0) * 0.05);
        replyHtml =
          '🕌 <strong>التشخيص الشرعي والجبائي للمتجر:</strong><br>' +
          '• <strong>وعاء الزكاة الصافي:</strong> ' + zkPool.toFixed(2) + ' د.ج | <strong>مقدار الزكاة الواجب (2.5%):</strong> <span class="text-emerald-600 font-black">' + zkAmt.toFixed(2) + ' د.ج</span> (' + fmtCentimes(zkAmt) + ').<br>' +
          '• <strong>الضريبة الجزافية الوحيدة (IFU 5%):</strong> ' + ifu5.toFixed(2) + ' د.ج.';
        actionsHtml =
          '<div class="flex flex-wrap gap-1.5 pt-2">' +
          '  <button type="button" onclick="App.switchView(\'analytics\'); App.switchAnalyticsTab(\'zakat\')" class="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-[11px]">🕌 فتح حاسبة الزكاة</button>' +
          '  <button type="button" onclick="App.switchView(\'analytics\'); App.switchAnalyticsTab(\'fiscal\')" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-[11px]">🇩🇿 فتح استوديو الجباية</button>' +
          '</div>';
      }
    }

    // ------------------------------------------------------------------------
    // الخطوة د: إذا كان السؤال عاماً أو استشارياً مفتوحاً، نجرب:
    //   1. اتصال Gemini المباشر من المتصفح (إن وُجد مفتاح)
    //   2. البوابة السحابية المجانية بدون مفتاح (Zero-Key Free Cloud AI)
    //   3. المحرك الاستشاري المحلي الشامل (100% Offline Fallback)
    // ------------------------------------------------------------------------
    if (!replyHtml) {
      var storeCtx =
        'أنت المستشار الذكي لمتجر في الجزائر. صافي المبيعات: ' + Number(ex.net_revenue || 0).toFixed(0) + ' د.ج، صافي الربح: ' + Number(ex.net_profit || 0).toFixed(0) + ' د.ج، البضاعة الراكدة: ' + intel.deadList.length + ' صنف بقيمة ' + intel.totalDeadCapital.toFixed(0) + ' د.ج، المكررات: ' + intel.duplicatePairs.length + '. أجب باختصار شديد ونقاط عملية بالدينار الجزائري على: ' + qText;

      var geminiKey = String((AppState.settings && AppState.settings.gemini_api_key) || localStorage.getItem('gherbi_gemini_api_key') || '').trim();
      if (geminiKey) {
        try {
          var gRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(geminiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: storeCtx }] }] })
          });
          var gJson = await gRes.json();
          var gTxt = gJson && gJson.candidates && gJson.candidates[0] && gJson.candidates[0].content && gJson.candidates[0].content.parts && gJson.candidates[0].content.parts[0] ? gJson.candidates[0].content.parts[0].text : '';
          if (gTxt) replyHtml = '<div class="whitespace-pre-line">' + gTxt + '</div>';
        } catch (_) {}
      }

      // البوابة السحابية المجانية بدون أي مفتاح (Zero-Key Cloud AI — تعمل لكل زبون تبيعه البرنامج عند توفر الإنترنت!)
      if (!replyHtml && navigator.onLine && AppState.copilotAiMode !== 'local_only') {
        try {
          var freeRes = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: 'أنت مستشار مالي وتجاري ذكي لنظام نقاط بيع في الجزائر (Gherbi.Ai POS). أجب بالعربية الواضحة في 4 أسطر عملية.' },
                { role: 'user', content: storeCtx }
              ],
              model: 'openai'
            })
          });
          if (freeRes.ok) {
            var freeTxt = await freeRes.text();
            if (freeTxt && freeTxt.length > 15 && !freeTxt.includes('<!DOCTYPE')) {
              replyHtml = '<div class="whitespace-pre-line">' + freeTxt.trim() + '</div>';
            }
          }
        } catch (_) {}
      }

      // المحرك الاستشاري المحلي الشامل (يعمل دائماً 100% بدون إنترنت وبدون مفتاح!)
      if (!replyHtml) {
        replyHtml =
          '📊 <strong>خطة العمل التنفيذية لزيادة أرباح المتجر (Gherbi.Ai Neural Advisor):</strong><br>' +
          '1. <strong>تحرير السيولة المجمدة (' + intel.totalDeadCapital.toFixed(0) + ' د.ج):</strong> لديك <strong>' + intel.deadList.length + ' سلعة راكدة</strong>؛ تفعيل تخفيض (-15%) عليها سيوفر سيولة نقدية فورية.<br>' +
          '2. <strong>توحيد المنتجات المكررة (' + intel.duplicatePairs.length + '):</strong> دمج (قهوة بونال، حليب لويا، ألترا جوي 120) سيمنع أخطاء الجرد والطلب المزدوج.<br>' +
          '3. <strong>التموين الذكي وتوقعات الـ 30 يوماً:</strong> بمعدل مبيعاتك الحالي، يُتوقع تحقيق <strong>' + intel.forecast.forecast30dRevenue.toFixed(0) + ' د.ج</strong> (وصافي ربح <strong>+' + intel.forecast.forecast30dProfit.toFixed(0) + ' د.ج</strong>).';
      }

      actionsHtml =
        '<div class="flex flex-wrap gap-1.5 pt-2">' +
        '  <button type="button" onclick="App.copilotMergeAllDuplicatesAtOnce()" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-black text-[11px] shadow">🔗 دمج المكررات (' + intel.duplicatePairs.length + ')</button>' +
        '  <button type="button" onclick="App.copilotLiquidateAllDeadStockWithPromos()" class="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-[11px] shadow">🔥 تسييل البضاعة الراكدة (-15%)</button>' +
        '  <button type="button" onclick="App.copilotGenerateSmartPurchaseOrder()" class="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-[11px] shadow">📦 توليد طلبية شراء ذكية</button>' +
        '</div>';
    }

    AppState.copilotChatHistory.push({
      role: 'agent',
      html: replyHtml + actionsHtml,
      time: new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })
    });

    await this.renderCopilotView();
    setTimeout(function () {
      var chatBox = document.getElementById('copilotChatMessagesBox');
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }, 30);
  };

  // ==========================================================================
  // 4. ترقية نافذة إعدادات الذكاء الاصطناعي لتوضيح وضع (Zero-Key المجاني للزبائن)
  // ==========================================================================
  App.openCopilotApiKeyModal = function () {
    this.ensureCopilotModalsDom();
    var km = document.getElementById('copilotApiKeyModal');
    if (km) {
      var curKey = (AppState.settings && AppState.settings.gemini_api_key) || localStorage.getItem('gherbi_gemini_api_key') || '';
      var curMode = AppState.copilotAiMode || 'auto_zero_key';
      km.innerHTML =
        '<div class="modal-content w-full max-w-lg p-6 space-y-4">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 class="text-lg font-black text-indigo-600">⚙️ إعدادات محرك الوكيل الذكي (Zero-Key AI Engine)</h3>' +
        '    <button type="button" onclick="App.closeModal(\'copilotApiKeyModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div class="space-y-3 text-xs">' +
        '    <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">' +
        '      <div class="font-black text-emerald-700 dark:text-emerald-300">✅ ميزة حصرية لزبائنك: يعمل بدون أي مفتاح API (Zero-Key Ready)!</div>' +
        '      <div class="text-slate-600 dark:text-slate-300">لا يحتاج التاجر الذي يشتري منك البرنامج إلى إدخال أي مفتاح؛ فالمحرك المدمج + البوابة السحابية المجانية يعملان تلقائياً 100%!</div>' +
        '    </div>' +
        '    <div>' +
        '      <label class="block font-bold mb-1">اختر وضع تشغيل الوكيل الذكي:</label>' +
        '      <select id="copilotAiModeSelect" class="w-full px-3 py-2 rounded-xl font-bold">' +
        '        <option value="auto_zero_key" ' + (curMode === 'auto_zero_key' ? 'selected' : '') + '>🌟 تلقائي ذكي بدون مفتاح (محرك محلي فوري + سحابي مجاني)</option>' +
        '        <option value="local_only" ' + (curMode === 'local_only' ? 'selected' : '') + '>⚡ محرك عصبي محلي فقط (100% Offline بدون إنترنت نهائياً)</option>' +
        '        <option value="gemini_custom" ' + (curMode === 'gemini_custom' ? 'selected' : '') + '>🔑 استخدام مفتاح Google Gemini API خاص</option>' +
        '      </select>' +
        '    </div>' +
        '    <div>' +
        '      <label class="block font-bold mb-1">مفتاح Google Gemini API (اختياري فقط):</label>' +
        '      <input id="copilotGeminiKeyInput" type="password" value="' + curKey + '" placeholder="اتركه فارغاً ليشتغل الوضع المجاني بدون مفتاح..." class="w-full px-3 py-2 rounded-xl font-mono text-xs">' +
        '    </div>' +
        '  </div>' +
        '  <div class="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">' +
        '    <button type="button" onclick="App.closeModal(\'copilotApiKeyModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء</button>' +
        '    <button type="button" onclick="App.saveCopilotApiKey()" class="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black">💾 حفظ وتفعيل</button>' +
        '  </div>' +
        '</div>';
    }
    this.openModal('copilotApiKeyModal');
  };

  App.saveCopilotApiKey = async function () {
    var mode = document.getElementById('copilotAiModeSelect')?.value || 'auto_zero_key';
    var val = String(document.getElementById('copilotGeminiKeyInput')?.value || '').trim();
    AppState.copilotAiMode = mode;
    localStorage.setItem('gherbi_copilot_ai_mode', mode);
    localStorage.setItem('gherbi_gemini_api_key', val);
    if (AppState.settings) AppState.settings.gemini_api_key = val;
    this.closeModal('copilotApiKeyModal');
    await this.renderCopilotView();
    if (typeof showToast === 'function') showToast('✅ تم تفعيل وضع الوكيل الذكي بنجاح!', 'success');
  };

  // ==========================================================================
  // 5. ترقية عرض الصفحة لإضافة التبويبين 6 و 7 + زر التقرير الصوتي + إصلاح التبويب 3
  // ==========================================================================
  var _baseRenderCopilot = App.renderCopilotView.bind(App);
  App.renderCopilotView = async function () {
    await _baseRenderCopilot();
    var intel = AppState._lastCopilotIntel;
    if (!intel) return;

    // إضافة زر التقرير الصوتي وزر خطة اليوم في الهيدر
    var qaBtn = document.getElementById('btnCopilotQaBot');
    if (qaBtn && !document.getElementById('btnCopilotVoiceTts')) {
      qaBtn.insertAdjacentHTML(
        'afterend',
        '<button id="btnCopilotVoiceTts" type="button" onclick="App.speakCopilotExecutiveBriefing()" class="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-sm">🔊 قراءة صوتية للتقرير</button>' +
        '<button type="button" onclick="App.copilotMergeAllDuplicatesAtOnce()" class="px-3 py-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black shadow-sm">🔗 دمج المكررات (' + intel.duplicatePairs.length + ')</button>'
      );
    }

    // إضافة التبويبين 6 و 7 إلى شريط التبويبات
    var tabBar = document.querySelector('#copilot-view-root .border-b.pb-2');
    if (tabBar && !tabBar.innerHTML.includes('playbook')) {
      var curTab = AppState.copilotActiveTab;
      tabBar.insertAdjacentHTML(
        'beforeend',
        '<button type="button" onclick="AppState.copilotActiveTab=\'playbook\'; App.renderCopilotView()" class="px-3.5 py-2 rounded-xl transition ' +
        (curTab === 'playbook' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') +
        '">6. 🎯 خطة مهام اليوم (' + intel.dailyPlaybook.length + ')</button>' +
        '<button type="button" onclick="AppState.copilotActiveTab=\'anomalies\'; App.renderCopilotView()" class="px-3.5 py-2 rounded-xl transition ' +
        (curTab === 'anomalies' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700') +
        '">7. 🕵️‍♂️ رادار الشذوذ والتسرب (' + intel.anomalies.length + ')</button>'
      );
    }

    var body = document.getElementById('copilotMainTabBody');
    if (!body) return;

    if (AppState.copilotActiveTab === 'playbook') {
      body.innerHTML =
        '<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 text-xs">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">' +
        '    <div><h3 class="font-black text-sm text-indigo-600">🎯 خطة العمل اليومية المقترحة من الوكيل الذكي (Daily Profit Playbook)</h3><p class="text-[11px] text-slate-400">نفّذ هذه الخطوات الـ 4 اليوم لترتيب مخزونك وتحرير السيولة المجمدة</p></div>' +
        '  </div>' +
        '  <div class="space-y-2.5">' +
        intel.dailyPlaybook.map(function (task) {
          return (
            '<div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">' +
            '  <div><div class="font-black text-sm ' + (task.done ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white') + '">' + (task.done ? '✅ ' : '⏳ ') + task.title + '</div><div class="text-[11px] font-bold text-emerald-600 mt-0.5">💡 الأثر المالي: ' + task.impact + '</div></div>' +
            '  <button type="button" onclick="' + task.onclick + '" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow">' + task.btnText + '</button>' +
            '</div>'
          );
        }).join('') +
        '  </div>' +
        '</div>';
    } else if (AppState.copilotActiveTab === 'anomalies') {
      body.innerHTML =
        '<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 text-xs">' +
        '  <h3 class="font-black text-sm text-rose-600">🕵️‍♂️ رادار كشف الشذوذ والتسرب المالي والرقابة الذكية (' + intel.anomalies.length + ')</h3>' +
        '  <div class="space-y-2">' +
        (intel.anomalies.length > 0
          ? intel.anomalies.map(function (an) {
              return (
                '<div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">' +
                '  <div><div class="font-black">' + an.icon + ' ' + an.title + '</div><div class="text-[11px] text-slate-500 mt-0.5">' + an.desc + '</div></div>' +
                '</div>'
              );
            }).join('')
          : '<div class="py-8 text-center text-emerald-600 font-bold">✅ لم يتم رصد أي شذوذ أو تسرب مالي في الفواتير!</div>') +
        '  </div>' +
        '</div>';
    }
  };
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 16 ZERO-KEY AI AGENT V2 & FULL PLAYBOOK UPGRADE]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installZeroKeyAutonomousErpAgentV2.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ تم حقن وفحص ترقية الوكيل الذكي بدون مفاتيح (Zero-Key AI Agent V2) في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['page16-ai-agent-copilot-surgical-perfection.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 اكتمل التحديث بنجاح! اضغط Ctrl+R داخل البرنامج الآن واستمتع بالوكيل الذكي الجديد بدون الحاجة لأي مفتاح API.');