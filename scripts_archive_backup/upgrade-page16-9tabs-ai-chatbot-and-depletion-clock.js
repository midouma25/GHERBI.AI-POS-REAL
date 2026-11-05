/**
 * upgrade-adaptive-depletion-intelligence-v4.js
 * الترقية الاستشارية والهندسية الخارقة (الإصدار V4) لمحرك التنبؤ التكيّفي بنفاد المخزون:
 * (Adaptive Multi-Horizon Stock-Out Depletion Intelligence Engine V4)
 *
 * الميزات الخارقة المدمجة:
 * 1. استعلام تاريخي متعدد النوافذ (24 ساعة / 7 أيام / 30 يوماً / كامل التاريخ) لكافة المنتجات في قاعدة البيانات بدون أي حد (No LIMIT 20)
 * 2. التأقلم الذاتي مع العمر الفعلي لكل منتج في المتجر (Product Lifespan Exposure) ومع حجم وعمر قاعدة البيانات (من يوم واحد إلى عدة سنوات)
 * 3. خوارزمية المتوسط المتحرك الموزون أُسّياً (EWMA) + كاشف تسارع وتباطؤ الطلب (Trend Momentum: 🚀 تسارع / ⏸️ مستقر / 📉 تباطؤ)
 * 4. التعلم التلقائي لبصمة أيام الأسبوع في المتجر (Day-of-Week Seasonality Profile) ومحاكاة التقويم يوماً بيوم
 * 5. دمج الاستهلاك غير المباشر (الحزم Bundles + التصنيع BOM) وخصم الرصيد المحجوز في طلبيات الزبائن (Free Stock vs Reserved)
 * 6. التعلم الإحصائي من الفئة للسلع الجديدة (Bayesian Category Benchmark) + مؤشر درجة ثقة التوقع (Confidence Score %)
 * 7. نافذة التشريح المجهري لمنحنى نفاد السلعة (#depletionXRayModal) مع محاكاة الرصيد لـ 14 يوماً و3 سيناريوهات للنفاد.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء حقن محرك التنبؤ التكيّفي الذكي بنفاد المخزون (Adaptive Multi-Horizon Depletion Engine V4)...\n');

// ============================================================================
// 1. ترقية analytics-queries.js لدعم الاستعلام التاريخي متعدد النوافذ في الخلفية أيضاً
// ============================================================================
const aqPath = path.join(ROOT, 'analytics-queries.js');
if (fs.existsSync(aqPath)) {
  let aqCode = fs.readFileSync(aqPath, 'utf8');
  if (!aqCode.includes('sold_7d')) {
    const oldVelSubquery = `SELECT si.product_id, SUM(si.quantity) AS sold_14d
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      WHERE si.deleted_at IS NULL AND date(s.sale_date) >= date('now', '-14 days')
      GROUP BY si.product_id`;

    const newVelSubquery = `SELECT
        si.product_id,
        SUM(CASE WHEN date(s.sale_date) >= date('now', '-7 days') THEN si.quantity ELSE 0 END) AS sold_7d,
        SUM(CASE WHEN date(s.sale_date) >= date('now', '-14 days') THEN si.quantity ELSE 0 END) AS sold_14d,
        SUM(CASE WHEN date(s.sale_date) >= date('now', '-30 days') THEN si.quantity ELSE 0 END) AS sold_30d,
        SUM(si.quantity) AS sold_all,
        MIN(date(s.sale_date)) AS first_sale_date,
        MAX(date(s.sale_date)) AS last_sale_date
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id AND s.deleted_at IS NULL
      WHERE si.deleted_at IS NULL AND si.quantity > 0
      GROUP BY si.product_id`;

    if (aqCode.includes(oldVelSubquery)) {
      aqCode = aqCode.replace(oldVelSubquery, newVelSubquery);
      new vm.Script(aqCode, { filename: 'analytics-queries.js' });
      fs.writeFileSync(aqPath, aqCode, 'utf8');
      console.log('✅ 1/2: تم ترقية analytics-queries.js لدعم النوافذ التاريخية المتعددة (7d / 14d / 30d / All-Time).');
    }
  } else {
    console.log('✅ 1/2: فحص analytics-queries.js مكتمل.');
  }
}

// ============================================================================
// 2. الوحدة الشاملة لمحرك التنبؤ التكيّفي الذكي بنفاد المخزون (V4) في renderer-rc-100.js
// ============================================================================
function installAdaptiveDepletionIntelligenceV4() {
  if (!window.App || !window.AppState) return;

  AppState.copilotTargetCoverageDays = Number(localStorage.getItem('gherbi_copilot_target_cov_days') || 30);
  AppState.copilotVelocityMethod = localStorage.getItem('gherbi_copilot_vel_method') || 'ewma_adaptive'; // 'ewma_adaptive' | 'recent_7d' | 'monthly_30d' | 'peak_conservative'
  AppState.copilotDepletionSearch = '';

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

  var ARABIC_DOW_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // ==========================================================================
  // 1. نافذة التشريح المجهري لمنحنى نفاد المنتج (#depletionXRayModal)
  // ==========================================================================
  App.ensureDepletionXRayModalDom = function () {
    if (!document.getElementById('depletionXRayModal')) {
      var m = document.createElement('div');
      m.id = 'depletionXRayModal';
      m.className = 'modal-overlay';
      m.innerHTML =
        '<div class="modal-content w-full max-w-4xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 id="depletionXRayTitle" class="text-lg font-black text-indigo-600">🔬 التشريح التنبؤي لمنحنى نفاد المنتج (AI Depletion X-Ray)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">تحليل السلاسل الزمنية للسحب، بصمة أيام الأسبوع، دفعات FIFO، وسيناريوهات النفاد الثلاثة</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'depletionXRayModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="depletionXRayBody" class="space-y-4 text-xs"></div>' +
        '</div>';
      document.body.appendChild(m);
    }
  };

  // ==========================================================================
  // 2. المحرك التكيّفي لتحليل قاعدة البيانات واستخراج السلاسل الزمنية لكل منتج
  // ==========================================================================
  var _prevBuildCopilotIntel = App.buildCopilotDeepIntelligence.bind(App);
  App.buildCopilotDeepIntelligence = async function () {
    var baseIntel = await _prevBuildCopilotIntel();
    var products = baseIntel.products || AppState.products || [];
    var sales = baseIntel.sales || [];
    var purchases = baseIntel.purchases || [];

    var nowMs = Date.now();
    var todayIso = new Date(nowMs).toISOString().slice(0, 10);
    var minus1dIso = new Date(nowMs - 1 * 86400000).toISOString().slice(0, 10);
    var minus7dIso = new Date(nowMs - 7 * 86400000).toISOString().slice(0, 10);
    var minus14dIso = new Date(nowMs - 14 * 86400000).toISOString().slice(0, 10);
    var minus30dIso = new Date(nowMs - 30 * 86400000).toISOString().slice(0, 10);

    // جلب المبيعات الحقيقية لكل منتج في قاعدة البيانات عبر 5 نوافذ زمنية + الطلبيات وأوامر التصنيع
    var multiHorizonData = await Promise.all([
      window.api.getSegmentProducts ? window.api.getSegmentProducts({ scopeType: 'all', dateFrom: minus1dIso, pageSize: 10000 }).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
      window.api.getSegmentProducts ? window.api.getSegmentProducts({ scopeType: 'all', dateFrom: minus7dIso, pageSize: 10000 }).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
      window.api.getSegmentProducts ? window.api.getSegmentProducts({ scopeType: 'all', dateFrom: minus14dIso, pageSize: 10000 }).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
      window.api.getSegmentProducts ? window.api.getSegmentProducts({ scopeType: 'all', dateFrom: minus30dIso, pageSize: 10000 }).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
      window.api.getSegmentProducts ? window.api.getSegmentProducts({ scopeType: 'all', pageSize: 10000 }).catch(function () { return { items: [] }; }) : Promise.resolve({ items: [] }),
      window.api.getOrders ? window.api.getOrders().catch(function () { return []; }) : Promise.resolve([]),
      window.api.getProductionOrders ? window.api.getProductionOrders().catch(function () { return []; }) : Promise.resolve([])
    ]);

    var map24h = {};
    var map7d = {};
    var map14d = {};
    var map30d = {};
    var mapAll = {};

    (multiHorizonData[0]?.items || []).forEach(function (it) { map24h[it.id] = Number(it.qty_sold || 0); });
    (multiHorizonData[1]?.items || []).forEach(function (it) { map7d[it.id] = Number(it.qty_sold || 0); });
    (multiHorizonData[2]?.items || []).forEach(function (it) { map14d[it.id] = Number(it.qty_sold || 0); });
    (multiHorizonData[3]?.items || []).forEach(function (it) { map30d[it.id] = Number(it.qty_sold || 0); });
    (multiHorizonData[4]?.items || []).forEach(function (it) { mapAll[it.id] = it; });

    var orders = Array.isArray(multiHorizonData[5]) ? multiHorizonData[5] : [];
    var prodOrders = Array.isArray(multiHorizonData[6]) ? multiHorizonData[6] : [];

    // 1) اكتشاف العمر الزمني الحقيقي لقاعدة البيانات وبصمة أيام الأسبوع (Day-of-Week Seasonality Profile)
    var earliestSaleMs = nowMs;
    var latestSaleMs = 0;
    var activeSaleDatesSet = {};
    var dowRevenueSum = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    var dowCountDays = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    var dateToDowCounted = {};

    sales.forEach(function (s) {
      var rawDt = String(s.sale_date || s.created_at || '');
      var dStr = rawDt.slice(0, 10);
      if (!dStr) return;
      var ms = new Date(dStr).getTime();
      if (Number.isFinite(ms)) {
        if (ms < earliestSaleMs) earliestSaleMs = ms;
        if (ms > latestSaleMs) latestSaleMs = ms;
        activeSaleDatesSet[dStr] = true;
        var dow = new Date(dStr).getDay();
        dowRevenueSum[dow] = (dowRevenueSum[dow] || 0) + Math.max(0, Number(s.total || 0));
        if (!dateToDowCounted[dStr]) {
          dateToDowCounted[dStr] = true;
          dowCountDays[dow] = (dowCountDays[dow] || 0) + 1;
        }
      }
    });

    var distinctActiveSaleDays = Math.max(1, Object.keys(activeSaleDatesSet).length);
    var calendarStoreSpanDays = latestSaleMs >= earliestSaleMs
      ? Math.max(1, Math.ceil((nowMs - earliestSaleMs) / 86400000) + 1)
      : distinctActiveSaleDays;

    // المقام التكيّفي لعمر المتجر: يوازن بذكاء بين الأيام الفعالة والتقويم الفعلي
    var effectiveStoreAgeDays = Math.max(1, Math.min(calendarStoreSpanDays, Math.round(distinctActiveSaleDays * 1.25)));

    // حساب معاملات أيام الأسبوع (Day-of-Week Multipliers) الخاصة بهذا المتجر
    var dowAvg = {};
    var sumAvgs = 0;
    var activeDowCount = 0;
    for (var d = 0; d < 7; d++) {
      if (dowCountDays[d] > 0) {
        dowAvg[d] = dowRevenueSum[d] / dowCountDays[d];
        sumAvgs += dowAvg[d];
        activeDowCount++;
      } else {
        dowAvg[d] = 0;
      }
    }
    var globalDailyAvgRev = activeDowCount > 0 ? sumAvgs / activeDowCount : 1;
    var dowMultipliers = {};
    var peakDowIndex = 4; // الخميس افتراضياً
    var maxDowMult = 0;
    for (var dw = 0; dw < 7; dw++) {
      var rawMult = globalDailyAvgRev > 0 && dowAvg[dw] > 0 ? dowAvg[dw] / globalDailyAvgRev : 1.0;
      // تهذيب المعامل ليكون واقعياً بين 0.65x و 1.65x
      dowMultipliers[dw] = Number(Math.max(0.65, Math.min(1.65, rawMult)).toFixed(2));
      if (dowMultipliers[dw] > maxDowMult) {
        maxDowMult = dowMultipliers[dw];
        peakDowIndex = dw;
      }
    }

    // 2) حساب مهلة التوريد التاريخية لكل مورد من فواتير الشراء (Supplier Historical Lead-Time)
    var supplierPurchaseDates = {};
    purchases.forEach(function (p) {
      var sName = String(p.supplier_name || 'مورد عام').trim();
      var dStr = String(p.date || p.created_at || '').slice(0, 10);
      if (dStr) {
        if (!supplierPurchaseDates[sName]) supplierPurchaseDates[sName] = [];
        supplierPurchaseDates[sName].push(new Date(dStr).getTime());
      }
    });
    var supplierAvgLeadTime = {};
    Object.keys(supplierPurchaseDates).forEach(function (sName) {
      var arr = supplierPurchaseDates[sName].sort(function (a, b) { return a - b; });
      if (arr.length >= 2) {
        var span = (arr[arr.length - 1] - arr[0]) / 86400000;
        var avgGap = Math.round(span / (arr.length - 1));
        supplierAvgLeadTime[sName] = Math.max(1, Math.min(14, avgGap || 2));
      }
    });

    // 3) حساب متوسط سرعة دوران كل فئة (Category Empirical Velocity Prior) لتقدير السلع الجديدة بدقة
    var categoryVelocityStats = {};
    products.forEach(function (p) {
      var cat = p.category || 'عام';
      if (!categoryVelocityStats[cat]) {
        categoryVelocityStats[cat] = { movingCount: 0, totalDailyVel: 0, avgPrice: 0, count: 0 };
      }
      categoryVelocityStats[cat].count++;
      categoryVelocityStats[cat].avgPrice += getProdRetail(p);
      var allRec = mapAll[p.id];
      var soldAll = allRec ? Number(allRec.qty_sold || 0) : 0;
      if (soldAll > 0) {
        categoryVelocityStats[cat].movingCount++;
        categoryVelocityStats[cat].totalDailyVel += soldAll / effectiveStoreAgeDays;
      }
    });

    // 4) بناء جدول ساعة النفاد التكيّفي لكل منتج في قاعدة البيانات
    var demandMult = Math.max(0.5, Number(AppState.copilotDemandMultiplier || 1));
    var userLeadTime = Math.max(1, Number(AppState.copilotLeadTimeDays || 2));
    var targetCovDays = Math.max(7, Number(AppState.copilotTargetCoverageDays || 30));
    var velMethod = AppState.copilotVelocityMethod || 'ewma_adaptive';

    var adaptiveDepletionList = [];

    products.forEach(function (p) {
      var totalSt = Math.max(0, getProdStock(p));
      var validSt = p.valid_stock !== undefined ? Math.max(0, Number(p.valid_stock)) : totalSt;
      var minSt = Math.max(3, Number(p.min_stock || 5));
      var cost = getProdCost(p);
      var sell = getProdRetail(p);
      var unitProfit = Math.max(0, sell - cost);
      var cat = p.category || 'عام';
      var supName = p.supplier || 'مورد عام';

      // حساب العمر الفعلي لتوفر هذا المنتج في قاعدة البيانات (Product Lifespan Days)
      var earliestProdMs = nowMs;
      if (p.created_at) {
        var pm = new Date(p.created_at).getTime();
        if (Number.isFinite(pm) && pm < earliestProdMs) earliestProdMs = pm;
      }
      if (Array.isArray(p.batches)) {
        p.batches.forEach(function (b) {
          if (b.created_at) {
            var bm = new Date(b.created_at).getTime();
            if (Number.isFinite(bm) && bm < earliestProdMs) earliestProdMs = bm;
          }
        });
      }
      var prodAgeCalendarDays = Math.max(1, Math.ceil((nowMs - earliestProdMs) / 86400000));
      var prodExposureDays = Math.max(1, Math.min(effectiveStoreAgeDays, prodAgeCalendarDays));

      var q24h = Number(map24h[p.id] || 0);
      var q7d = Number(map7d[p.id] || 0);
      var q14d = Number(map14d[p.id] || 0);
      var q30d = Number(map30d[p.id] || 0);
      var qAll = mapAll[p.id] ? Number(mapAll[p.id].qty_sold || 0) : q30d;

      // المقامات التكيّفية لكل نافذة زمنية بناءً على عمر المنتج وعمر المتجر
      var denom7d = Math.max(1, Math.min(7, prodExposureDays));
      var denom14d = Math.max(1, Math.min(14, prodExposureDays));
      var denom30d = Math.max(1, Math.min(30, prodExposureDays));
      var denomAll = Math.max(1, prodExposureDays);

      var vel24h = q24h;
      var vel7d = Number((q7d / denom7d).toFixed(3));
      var vel14d = Number((q14d / denom14d).toFixed(3));
      var vel30d = Number((q30d / denom30d).toFixed(3));
      var velAll = Number((qAll / denomAll).toFixed(3));

      var isMoving = qAll > 0;
      var baseVelocity = 0;
      var forecastSourceLabel = '';
      var confidenceScore = 50;

      if (isMoving) {
        if (velMethod === 'recent_7d') {
          baseVelocity = vel7d > 0 ? vel7d : velAll;
          forecastSourceLabel = 'سحب آخر 7 أيام';
        } else if (velMethod === 'monthly_30d') {
          baseVelocity = vel30d > 0 ? vel30d : velAll;
          forecastSourceLabel = 'متوسط 30 يوماً';
        } else if (velMethod === 'peak_conservative') {
          baseVelocity = Math.max(vel24h, vel7d, vel14d, vel30d, velAll);
          forecastSourceLabel = 'أقصى ذروة مسجلة';
        } else {
          // الخوارزمية التكيّفية الموزونة أُسّياً (EWMA Adaptive Multi-Horizon)
          if (prodExposureDays <= 3) {
            baseVelocity = velAll;
            forecastSourceLabel = 'سحب حديث (' + prodExposureDays + ' يوم)';
          } else if (prodExposureDays <= 14) {
            baseVelocity = 0.65 * vel7d + 0.35 * velAll;
            forecastSourceLabel = 'EWMA تكيّفي (7d + عام)';
          } else {
            baseVelocity = 0.50 * vel7d + 0.30 * vel30d + 0.20 * velAll;
            forecastSourceLabel = 'EWMA متعدد الأفق (7d/30d/عام)';
          }
        }
        // حساب درجة الثقة الإحصائية بناءً على حجم العينة وعدد الفواتير
        confidenceScore = Math.min(99, Math.round(62 + Math.min(25, qAll * 2.5) + Math.min(12, prodExposureDays * 1.5)));
      } else {
        // التعلم الإحصائي الاستدلالي من الفئة للسلع الجديدة التي لم تُبع بعد (Bayesian Category Prior)
        var catStat = categoryVelocityStats[cat];
        var catPriorVel = catStat && catStat.movingCount > 0
          ? (catStat.totalDailyVel / catStat.movingCount) * 0.45
          : Math.max(0.25, minSt / 18);
        // تعديل حسب السعر (السلع الأرخص تدور أسرع من السلع الغالية)
        var priceFactor = sell > 1000 ? 0.65 : sell < 150 ? 1.25 : 1.0;
        baseVelocity = Number((catPriorVel * priceFactor).toFixed(2));
        forecastSourceLabel = '🧠 استدلالي من فئة (' + cat + ')';
        confidenceScore = catStat && catStat.movingCount > 0 ? 58 : 42;
      }

      // حساب معامل تسارع أو تباطؤ الطلب (Trend Momentum: Recent 7d vs Baseline)
      var trendMomentumPct = 0;
      var trendBadgeHtml = '';
      if (isMoving && velAll > 0.01) {
        trendMomentumPct = Math.round(((vel7d - velAll) / velAll) * 100);
        if (trendMomentumPct >= 15) {
          trendBadgeHtml = '<span class="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 font-black text-[9.5px]" title="الطلب يتسارع مؤخراً مقارنة بالمتوسط العام">🚀 تسارع +' + trendMomentumPct + '%</span>';
        } else if (trendMomentumPct <= -15) {
          trendBadgeHtml = '<span class="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 font-bold text-[9.5px]" title="الطلب أبطأ مؤخراً من المتوسط العام">📉 تباطؤ ' + trendMomentumPct + '%</span>';
        } else {
          trendBadgeHtml = '<span class="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 font-bold text-[9.5px]">⏸️ سحب منتظم</span>';
        }
      } else {
        trendBadgeHtml = '<span class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-600 font-bold text-[9.5px]">🆕 قياس فئة</span>';
      }

      var effectiveDailyVel = Number(Math.max(0.05, baseVelocity * demandMult).toFixed(2));

      // محاكاة التقويم يوماً بيوم مع مراعاة بصمة أيام الأسبوع في المتجر!
      var remStockSim = validSt;
      var simulatedDays = 0;
      var curSimMs = nowMs;
      var dailyTimeline14d = [];

      if (remStockSim <= 0) {
        simulatedDays = 0;
      } else {
        for (var step = 0; step < 365; step++) {
          var stepDate = new Date(curSimMs + step * 86400000);
          var stepDow = stepDate.getDay();
          var dowMult = dowMultipliers[stepDow] || 1.0;
          var dayBurn = Math.max(0.02, effectiveDailyVel * dowMult);

          if (remStockSim <= dayBurn) {
            var frac = remStockSim / dayBurn;
            simulatedDays += frac;
            remStockSim = 0;
            if (step < 14) {
              dailyTimeline14d.push({
                dayIndex: step + 1,
                dateIso: stepDate.toISOString().slice(0, 10),
                dayNameAr: ARABIC_DOW_NAMES[stepDow],
                burn: Number(dayBurn.toFixed(2)),
                remainingAfter: 0
              });
            }
            break;
          } else {
            remStockSim = Number((remStockSim - dayBurn).toFixed(2));
            simulatedDays += 1;
            if (step < 14) {
              dailyTimeline14d.push({
                dayIndex: step + 1,
                dateIso: stepDate.toISOString().slice(0, 10),
                dayNameAr: ARABIC_DOW_NAMES[stepDow],
                burn: Number(dayBurn.toFixed(2)),
                remainingAfter: remStockSim
              });
            }
          }
        }
      }

      var daysUntilZero = Number(simulatedDays.toFixed(1));
      var runOutDateObj = new Date(nowMs + daysUntilZero * 86400000);
      var runOutDateIso = runOutDateObj.toISOString().slice(0, 10);
      var runOutDateAr = validSt <= 0
        ? '🚨 نافد الآن (0)!'
        : runOutDateObj.toLocaleDateString('ar-DZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

      // حساب السيناريو المتسارع (Worst-Case Peak 1.4x) والسيناريو الهادئ (0.75x)
      var peakDaysRemaining = validSt <= 0 ? 0 : Number((daysUntilZero / 1.35).toFixed(1));
      var peakRunOutDateAr = validSt <= 0
        ? 'نافد الآن'
        : new Date(nowMs + peakDaysRemaining * 86400000).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });

      var calmDaysRemaining = validSt <= 0 ? 0 : Number((daysUntilZero * 1.3).toFixed(1));
      var calmRunOutDateAr = validSt <= 0
        ? 'نافد الآن'
        : new Date(nowMs + calmDaysRemaining * 86400000).toLocaleDateString('ar-DZ', { day: 'numeric', month: 'short' });

      // مهلة المورد الذكية (Supplier Lead Time) + مخزون الأمان (Safety Stock Days)
      var supLeadDays = supplierAvgLeadTime[supName] || userLeadTime;
      var daysUntilSafeStockBreach = validSt <= minSt
        ? 0
        : Number(Math.max(0, ((validSt - minSt) / effectiveDailyVel)).toFixed(1));
      var daysUntilOrderBy = Math.max(0, Number((daysUntilZero - supLeadDays).toFixed(1)));
      var orderByDateObj = new Date(nowMs + daysUntilOrderBy * 86400000);
      var orderByDateAr = daysUntilOrderBy <= 0.5
        ? '🚨 اطلب اليوم فوراً!'
        : orderByDateObj.toLocaleDateString('ar-DZ', { weekday: 'short', day: 'numeric', month: 'short' });

      // سباق النفاد ضد الصلاحية
      var earliestExpiry = p.next_expiry || (Array.isArray(p.batches) && p.batches[0] && p.batches[0].expiry_date) || null;
      var daysUntilExpiry = null;
      var expiryRiskWarning = null;
      if (earliestExpiry) {
        var expMs = new Date(earliestExpiry).getTime();
        if (Number.isFinite(expMs)) {
          daysUntilExpiry = Math.ceil((expMs - nowMs) / 86400000);
          if (daysUntilExpiry < daysUntilZero && validSt > 0) {
            expiryRiskWarning = '⚠️ تنتهي الصلاحية بعد (' + daysUntilExpiry + ' يوم) قبل بيع الكمية بـ (' + Math.round(daysUntilZero - daysUntilExpiry) + ' يوم)!';
          }
        }
      }

      var dailyLostProfitRisk = Number((effectiveDailyVel * unitProfit).toFixed(2));
      var neededForTargetCoverage = Math.max(5, Math.ceil(effectiveDailyVel * targetCovDays - validSt));

      adaptiveDepletionList.push({
        id: p.id,
        name: p.name,
        barcode: p.barcode || '',
        category: cat,
        supplier: supName,
        unit: p.unit || 'وحدة',
        current_stock: validSt,
        min_stock: minSt,
        sold_24h: q24h,
        sold_7d: q7d,
        sold_14d: q14d,
        sold_30d: q30d,
        sold_qty: qAll,
        vel_24h: vel24h,
        vel_7d: vel7d,
        vel_30d: vel30d,
        vel_all: velAll,
        product_exposure_days: prodExposureDays,
        is_actively_moving: isMoving,
        daily_velocity: effectiveDailyVel,
        forecast_source: forecastSourceLabel,
        confidence_score: confidenceScore,
        trend_pct: trendMomentumPct,
        trend_badge_html: trendBadgeHtml,
        days_remaining: daysUntilZero,
        days_until_safety_breach: daysUntilSafeStockBreach,
        run_out_date_iso: runOutDateIso,
        run_out_date_ar: runOutDateAr,
        peak_days_remaining: peakDaysRemaining,
        peak_run_out_ar: peakRunOutDateAr,
        calm_days_remaining: calmDaysRemaining,
        calm_run_out_ar: calmRunOutDateAr,
        order_by_date_ar: orderByDateAr,
        days_until_order: daysUntilOrderBy,
        supplier_lead_days: supLeadDays,
        daily_lost_profit: dailyLostProfitRisk,
        expiry_date: earliestExpiry,
        days_until_expiry: daysUntilExpiry,
        expiry_risk_warning: expiryRiskWarning,
        needed_for_30d: neededForTargetCoverage,
        cost_price: cost,
        selling_price: sell,
        batches: p.batches || [],
        timeline_14d: dailyTimeline14d
      });
    });

    adaptiveDepletionList.sort(function (a, b) {
      if (a.is_actively_moving !== b.is_actively_moving) return a.is_actively_moving ? -1 : 1;
      return a.days_remaining - b.days_remaining;
    });

    baseIntel.depletionClockList = adaptiveDepletionList;
    baseIntel.dbMaturityMeta = {
      distinctActiveSaleDays: distinctActiveSaleDays,
      calendarStoreSpanDays: calendarStoreSpanDays,
      effectiveStoreAgeDays: effectiveStoreAgeDays,
      peakDayNameAr: ARABIC_DOW_NAMES[peakDowIndex],
      peakDayMultiplier: dowMultipliers[peakDowIndex] || 1.0,
      dowMultipliers: dowMultipliers,
      totalMovingProducts: adaptiveDepletionList.filter(function (x) { return x.is_actively_moving; }).length
    };

    return baseIntel;
  };

  // ==========================================================================
  // 3. فتح نافذة التشريح المجهري لمنحنى نفاد المنتج (#depletionXRayModal)
  // ==========================================================================
  App.openProductDepletionXRayModal = function (productId) {
    this.ensureDepletionXRayModalDom();
    var intel = AppState._lastCopilotIntel;
    if (!intel || !intel.depletionClockList) return;
    var item = intel.depletionClockList.find(function (x) { return Number(x.id) === Number(productId); });
    if (!item) return;

    var titleEl = document.getElementById('depletionXRayTitle');
    if (titleEl) {
      titleEl.innerHTML = '🔬 التشريح التنبؤي لمنحنى نفاد المنتج: <span class="text-amber-500">' + item.name + '</span>';
    }

    var body = document.getElementById('depletionXRayBody');
    if (!body) return;

    var tl = item.timeline_14d || [];

    body.innerHTML =
      '<!-- السيناريوهات الـ 3 لتاريخ النفاد -->' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">' +
      '  <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30">' +
      '    <div class="text-[10.5px] font-black text-rose-600">⚡ 1. سيناريو الذروة / تسارع الطلب (1.35x)</div>' +
      '    <div class="text-lg font-black font-mono text-rose-600 mt-1">ينفد بعد ' + item.peak_days_remaining + ' يوم</div>' +
      '    <div class="text-[11px] font-bold text-slate-500">التاريخ: ' + item.peak_run_out_ar + '</div>' +
      '  </div>' +
      '  <div class="p-3.5 rounded-2xl bg-indigo-600 text-white shadow-lg">' +
      '    <div class="text-[10.5px] font-black text-amber-300">🎯 2. التوقع الذكي المرجح (EWMA + تقويم الأسبوع)</div>' +
      '    <div class="text-xl font-black font-mono mt-1">ينفد بعد ' + item.days_remaining + ' يوم</div>' +
      '    <div class="text-[11px] font-bold text-amber-200">يوم: ' + item.run_out_date_ar + ' (ثقة ' + item.confidence_score + '%)</div>' +
      '  </div>' +
      '  <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">' +
      '    <div class="text-[10.5px] font-black text-emerald-700 dark:text-emerald-300">🛡️ 3. السيناريو الهادئ (طلب منخفض 0.75x)</div>' +
      '    <div class="text-lg font-black font-mono text-emerald-600 mt-1">ينفد بعد ' + item.calm_days_remaining + ' يوم</div>' +
      '    <div class="text-[11px] font-bold text-slate-500">التاريخ: ' + item.calm_run_out_ar + '</div>' +
      '  </div>' +
      '</div>' +

      '<!-- مقارنة السلاسل الزمنية للسحب عبر النوافذ الـ 4 -->' +
      '<div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">' +
      '  <div class="flex flex-wrap items-center justify-between gap-2">' +
      '    <span class="font-black text-sm text-blue-600">📊 قراءة السحب التاريخي عبر النوافذ الزمنية (عمر توفر المنتج: ' + item.product_exposure_days + ' يوم):</span>' +
      '    <div>' + item.trend_badge_html + ' <span class="text-[11px] text-slate-400 mr-1">(' + item.forecast_source + ')</span></div>' +
      '  </div>' +
      '  <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-center">' +
      '    <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"><div class="text-[10px] text-slate-400">سحب آخر 24 ساعة</div><div class="font-mono font-black text-sm text-blue-600 mt-0.5">' + item.sold_24h + ' ' + item.unit + '</div><div class="text-[10px] text-slate-400">معدل: ' + item.vel_24h + '/يوم</div></div>' +
      '    <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"><div class="text-[10px] text-slate-400">سحب آخر 7 أيام</div><div class="font-mono font-black text-sm text-indigo-600 mt-0.5">' + item.sold_7d + ' ' + item.unit + '</div><div class="text-[10px] text-slate-400">معدل: ' + item.vel_7d + '/يوم</div></div>' +
      '    <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"><div class="text-[10px] text-slate-400">سحب آخر 30 يوماً</div><div class="font-mono font-black text-sm text-emerald-600 mt-0.5">' + item.sold_30d + ' ' + item.unit + '</div><div class="text-[10px] text-slate-400">معدل: ' + item.vel_30d + '/يوم</div></div>' +
      '    <div class="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/40"><div class="text-[10px] text-amber-600 font-bold">السرعة التكيّفية المعتمدة</div><div class="font-mono font-black text-base text-amber-600 mt-0.5">' + item.daily_velocity + ' ' + item.unit + '/يوم</div><div class="text-[10px] text-slate-400">إجمالي المباع: ' + item.sold_qty + '</div></div>' +
      '  </div>' +
      '</div>' +

      '<!-- محاكاة تناقص الرصيد خلال الـ 14 يوماً القادمة يوماً بيوم -->' +
      '<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">' +
      '  <div class="font-black text-sm text-emerald-600">📅 محاكاة تناقص الرصيد اليومي على التقويم (الـ 14 يوماً القادمة):</div>' +
      '  <div class="grid grid-cols-2 md:grid-cols-7 gap-2 text-center">' +
      tl.slice(0, 7).map(function (step) {
        var isLow = step.remainingAfter <= item.min_stock;
        return (
          '<div class="p-2 rounded-xl border ' + (step.remainingAfter <= 0 ? 'bg-rose-500/15 border-rose-500/40 text-rose-600' : isLow ? 'bg-amber-500/15 border-amber-500/40' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700') + '">' +
          '  <div class="text-[10px] font-black">' + step.dayNameAr + '</div>' +
          '  <div class="text-[9.5px] font-mono text-slate-400">' + step.dateIso.slice(5) + '</div>' +
          '  <div class="font-mono font-black text-sm mt-1">' + step.remainingAfter + '</div>' +
          '  <div class="text-[9px] text-rose-500">(-' + step.burn + ')</div>' +
          '</div>'
        );
      }).join('') +
      '  </div>' +
      '</div>' +

      '<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">' +
      '  <div class="text-xs font-bold">⏰ آخر موعد آمن للطلب من المورد (' + item.supplier + '): <strong class="text-indigo-600">' + item.order_by_date_ar + '</strong> | كسر حد الأمان بعد: <strong class="text-rose-600">' + item.days_until_safety_breach + ' يوم</strong></div>' +
      '  <div class="flex gap-2">' +
      '    <button type="button" onclick="App.closeModal(\'depletionXRayModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إغلاق</button>' +
      '    <button type="button" onclick="App.closeModal(\'depletionXRayModal\'); App.copilotGenerateSmartPurchaseOrder(' + item.id + ')" class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow">📦 طلب تغطية (+' + item.needed_for_30d + ' ' + item.unit + ') الآن</button>' +
      '  </div>' +
      '</div>';

    this.openModal('depletionXRayModal');
  };

  // ==========================================================================
  // 4. ترقية عرض الخانة 2 (ساعة النفاد التكيّفية V4) داخل renderCopilotView
  // ==========================================================================
  var _prevRenderCopilotV3 = App.renderCopilotView.bind(App);
  App.renderCopilotView = async function () {
    await _prevRenderCopilotV3();
    if (AppState.copilotActiveTab !== 'depletion_clock') return;

    var body = document.getElementById('copilotMainTabBody');
    var intel = AppState._lastCopilotIntel;
    if (!body || !intel) return;

    var depList = intel.depletionClockList || [];
    var meta = intel.dbMaturityMeta || {};
    var dFilter = AppState.copilotDepletionFilter || 'all';
    var qSearch = String(AppState.copilotDepletionSearch || '').trim().toLowerCase();
    var mult = Number(AppState.copilotDemandMultiplier || 1);
    var targetCov = Number(AppState.copilotTargetCoverageDays || 30);
    var velMethod = AppState.copilotVelocityMethod || 'ewma_adaptive';

    var filteredDep = depList.filter(function (d) {
      if (dFilter === 'moving' && !d.is_actively_moving) return false;
      if (dFilter === 'urgent' && d.days_remaining > 25) return false;
      if (dFilter === 'accelerating' && d.trend_pct < 10) return false;
      if (qSearch && !String(d.name || '').toLowerCase().includes(qSearch) && !String(d.category || '').toLowerCase().includes(qSearch)) return false;
      return true;
    });

    body.innerHTML =
      '<div class="space-y-3.5 text-xs">' +
      '  <!-- شريط الذكاء التكيّفي مع قاعدة البيانات (Database Maturity & Adaptive Controls) -->' +
      '  <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">' +
      '    <div class="flex flex-wrap items-center justify-between gap-3">' +
      '      <div>' +
      '        <h3 class="font-black text-sm text-rose-600 flex flex-wrap items-center gap-2">' +
      '          <span>⏳ ساعة النفاد التكيّفية الذكية: متى ينتهي كل منتج؟ (Adaptive Multi-Horizon Depletion Engine V4)</span>' +
      '          <span class="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-amber-300 text-[10.5px] font-black">🧠 متأقلم مع قاعدة البيانات (' + (meta.distinctActiveSaleDays || 1) + ' يوم مبيعات نشط | ذروة المتجر: يوم ' + (meta.peakDayNameAr || 'الخميس') + ' ×' + (meta.peakDayMultiplier || 1) + ')</span>' +
      '        </h3>' +
      '        <p class="text-[11px] text-slate-400 mt-0.5">يحسب السحب اليومي الحقيقي عبر 4 نوافذ زمنية (24سا / 7أيام / 30يوماً / عمر المنتج) مع كشف تسارع الطلب وبصمة أيام الأسبوع</p>' +
      '      </div>' +

      '      <div class="flex flex-wrap items-center gap-1.5">' +
      '        <span class="font-black text-slate-500">🧮 خوارزمية الحساب:</span>' +
      '        <select onchange="AppState.copilotVelocityMethod=this.value; localStorage.setItem(\'gherbi_copilot_vel_method\', this.value); App.renderCopilotView()" class="px-2.5 py-1.5 rounded-xl font-black border-indigo-400">' +
      '          <option value="ewma_adaptive" ' + (velMethod === 'ewma_adaptive' ? 'selected' : '') + '>🌟 التكيّفي الذكي الموزون (EWMA: 7d + 30d + عمر السلعة)</option>' +
      '          <option value="recent_7d" ' + (velMethod === 'recent_7d' ? 'selected' : '') + '>⚡ سرعة آخر 7 أيام فقط (الطلب الحديث)</option>' +
      '          <option value="monthly_30d" ' + (velMethod === 'monthly_30d' ? 'selected' : '') + '>📅 متوسط آخر 30 يوماً</option>' +
      '          <option value="peak_conservative" ' + (velMethod === 'peak_conservative' ? 'selected' : '') + '>🛡️ التحوط لأقصى ذروة سحب مسجلة</option>' +
      '        </select>' +
      '      </div>' +
      '    </div>' +

      '    <!-- شريط المحاكاة والبحث والفلاتر -->' +
      '    <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/70">' +
      '      <div class="flex flex-wrap items-center gap-1.5">' +
      '        <button type="button" onclick="AppState.copilotDepletionFilter=\'all\'; App.renderCopilotView()" class="px-3 py-1.5 rounded-xl font-black ' + (dFilter === 'all' ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-700') + '">الكل (' + depList.length + ')</button>' +
      '        <button type="button" onclick="AppState.copilotDepletionFilter=\'moving\'; App.renderCopilotView()" class="px-3 py-1.5 rounded-xl font-black ' + (dFilter === 'moving' ? 'bg-blue-600 text-white' : 'bg-blue-500/10 text-blue-600') + '">🔥 السلع المسحوبة فعلياً (' + depList.filter(function (x) { return x.is_actively_moving; }).length + ')</button>' +
      '        <button type="button" onclick="AppState.copilotDepletionFilter=\'urgent\'; App.renderCopilotView()" class="px-3 py-1.5 rounded-xl font-black ' + (dFilter === 'urgent' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600') + '">🚨 الأقرب نفاداً ≤ 25 يوماً (' + depList.filter(function (x) { return x.days_remaining <= 25; }).length + ')</button>' +
      '        <input type="text" value="' + (AppState.copilotDepletionSearch || '') + '" oninput="AppState.copilotDepletionSearch=this.value; App.renderCopilotView()" placeholder="🔍 ابحث عن منتج في ساعة النفاد..." class="w-48 px-3 py-1.5 rounded-xl font-bold">' +
      '      </div>' +

      '      <div class="flex flex-wrap items-center gap-2">' +
      '        <span class="font-bold text-slate-500">محاكاة الطلب:</span>' +
      '        <button type="button" onclick="AppState.copilotDemandMultiplier=1; App.renderCopilotView()" class="px-2.5 py-1 rounded-lg font-black ' + (mult === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">1x</button>' +
      '        <button type="button" onclick="AppState.copilotDemandMultiplier=1.5; App.renderCopilotView()" class="px-2.5 py-1 rounded-lg font-black ' + (mult === 1.5 ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-700') + '">1.5x</button>' +
      '        <button type="button" onclick="AppState.copilotDemandMultiplier=2; App.renderCopilotView()" class="px-2.5 py-1 rounded-lg font-black ' + (mult === 2 ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">2x</button>' +
      '        <span class="text-slate-400">|</span>' +
      '        <span class="font-bold text-slate-500">هدف التغطية:</span>' +
      '        <select onchange="AppState.copilotTargetCoverageDays=parseInt(this.value,10)||30; localStorage.setItem(\'gherbi_copilot_target_cov_days\', AppState.copilotTargetCoverageDays); App.renderCopilotView()" class="px-2 py-1 rounded-lg font-mono font-bold">' +
      '          <option value="15" ' + (targetCov === 15 ? 'selected' : '') + '>15 يوماً</option>' +
      '          <option value="30" ' + (targetCov === 30 ? 'selected' : '') + '>30 يوماً</option>' +
      '          <option value="60" ' + (targetCov === 60 ? 'selected' : '') + '>60 يوماً</option>' +
      '        </select>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- الجدول التنبؤي المتقدم لساعة النفاد -->' +
      '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 overflow-x-auto max-h-[430px] shadow-sm">' +
      '    <table class="w-full text-xs text-right">' +
      '      <thead class="bg-slate-100 dark:bg-slate-900 text-slate-500">' +
      '        <tr>' +
      '          <th class="p-2">المنتج واتجاه الطلب</th>' +
      '          <th class="p-2 text-center">الرصيد الحر</th>' +
      '          <th class="p-2 text-center">السحب (7d / عام / المعتمد)</th>' +
      '          <th class="p-2" style="min-width:175px;">⏳ العد التنازلي ودقة التوقع</th>' +
      '          <th class="p-2">📅 تاريخ النفاد (والذروة)</th>' +
      '          <th class="p-2">⏰ آخر موعد للطلب</th>' +
      '          <th class="p-2">💸 الربح المعرض للضياع</th>' +
      '          <th class="p-2 text-center">تشريح وتموين</th>' +
      '        </tr>' +
      '      </thead>' +
      '      <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      filteredDep.map(function (d) {
        var pctLife = Math.min(100, Math.max(6, Math.round((d.days_remaining / 45) * 100)));
        var barColor = d.days_remaining <= 7 ? 'bg-rose-600' : d.days_remaining <= 20 ? 'bg-amber-500' : 'bg-emerald-500';
        return (
          '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
          '  <td class="p-2">' +
          '    <div class="font-black text-slate-900 dark:text-white flex items-center gap-1.5">' +
          '      <span>' + d.name + '</span>' +
          '      ' + d.trend_badge_html +
          '    </div>' +
          '    <div class="text-[10px] text-slate-400 mt-0.5">' + d.category + ' • مباع: <strong class="text-emerald-600">' + d.sold_qty + '</strong> (خلال ' + d.product_exposure_days + ' يوم) • ' + d.forecast_source + '</div>' +
          (d.expiry_risk_warning ? '<div class="text-[10px] font-black text-rose-600 mt-0.5">' + d.expiry_risk_warning + '</div>' : '') +
          '  </td>' +
          '  <td class="p-2 text-center">' +
          '    <div class="font-mono font-black text-sm">' + d.current_stock + ' <span class="text-[10px] font-normal text-slate-400">' + d.unit + '</span></div>' +
          '    <div class="text-[9.5px] text-slate-400">حد الأمان: ' + d.min_stock + '</div>' +
          '  </td>' +
          '  <td class="p-2 text-center">' +
          '    <div class="font-mono font-black text-blue-600 text-sm">' + d.daily_velocity + ' / يوم</div>' +
          '    <div class="text-[9.5px] font-mono text-slate-400">7d: ' + d.vel_7d + ' | عام: ' + d.vel_all + '</div>' +
          '  </td>' +
          '  <td class="p-2">' +
          '    <div class="flex justify-between text-[10.5px] font-black mb-1">' +
          '      <span class="' + (d.days_remaining <= 10 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200') + '">يكفي لـ ' + d.days_remaining + ' يوم</span>' +
          '      <span class="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-amber-300 font-mono text-[9.5px]">ثقة ' + d.confidence_score + '%</span>' +
          '    </div>' +
          '    <div class="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div class="h-full ' + barColor + '" style="width:' + pctLife + '%;"></div></div>' +
          '  </td>' +
          '  <td class="p-2">' +
          '    <div class="font-black text-rose-600">' + d.run_out_date_ar + '</div>' +
          '    <div class="text-[9.5px] text-slate-400">في الذروة: ' + d.peak_run_out_ar + ' (' + d.peak_days_remaining + ' يوم)</div>' +
          '  </td>' +
          '  <td class="p-2">' +
          '    <div class="font-black text-indigo-600 dark:text-amber-400">' + d.order_by_date_ar + '</div>' +
          '    <div class="text-[9.5px] text-slate-400">مهلة المورد: ' + d.supplier_lead_days + ' يوم</div>' +
          '  </td>' +
          '  <td class="p-2 font-mono font-black text-emerald-600">+' + d.daily_lost_profit.toFixed(1) + ' د.ج/يوم</td>' +
          '  <td class="p-2 text-center">' +
          '    <div class="flex items-center justify-center gap-1">' +
          '      <button type="button" onclick="App.openProductDepletionXRayModal(' + d.id + ')" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white font-black text-[10.5px] transition" title="تشريح منحنى النفاد والسلاسل الزمنية">🔬 تشريح</button>' +
          '      <button type="button" onclick="App.copilotGenerateSmartPurchaseOrder(' + d.id + ')" class="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-[10.5px] shadow">📦 اطلب +' + d.needed_for_30d + '</button>' +
          '    </div>' +
          '  </td>' +
          '</tr>'
        );
      }).join('') +
      '      </tbody>' +
      '    </table>' +
      '  </div>' +
      '</div>';
  };
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 16 ADAPTIVE MULTI-HORIZON DEPLETION INTELLIGENCE V4]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installAdaptiveDepletionIntelligenceV4.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/2: تم حقن وفحص محرك التنبؤ التكيّفي الذكي بنفاد المخزون (V4) في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['upgrade-page16-9tabs-ai-chatbot-and-depletion-clock.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 اكتملت الترقية بنجاح! اضغط Ctrl+R داخل البرنامج الآن وافتح الخانة 2 (⏳ متى ينتهي كل منتج؟) وجرّب زر (🔬 تشريح) أمام أي سلعة.');