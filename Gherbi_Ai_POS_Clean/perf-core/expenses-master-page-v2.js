/**
 * perf-core/expenses-master-page-v2.js
 * صفحة المصاريف والخزائن الموحّدة (تبويبان نظيفان: 1. المصاريف والأموال الخارجة | 2. دفتر الخزائن الأربعة)
 */
'use strict';
(function buildCleanExpensesMasterPageV2() {
  (function initGherbiExpensesMasterV2() {
    'use strict';

    if (window.GherbiExpensesMasterV2 && window.GherbiExpensesMasterV2._installed) return;

    function esc(s) {
      return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtDzd(v) {
      return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.ج';
    }

    function fmtCent(v) {
      const n = Number(v || 0);
      if (!Number.isFinite(n) || Math.abs(n) < 0.005) return '0 سنتيم';
      const totalC = Math.round(Math.abs(n) * 100);
      const m = Math.floor(totalC / 1000000);
      const t = Math.floor((totalC % 1000000) / 1000);
      const r = totalC % 1000;
      const p = [];
      if (m > 0) p.push(m === 1 ? 'مليون' : m === 2 ? 'مليونين' : m + ' مليون');
      if (t > 0) p.push(t === 1 ? 'ألف' : t === 2 ? 'ألفين' : t + ' ألف');
      if (r > 0) p.push(String(r));
      return (n < 0 ? '-' : '') + p.join(' و ') + ' سنتيم';
    }

    function srcBadgeHtml(src, lbl) {
      const s = String(src || 'active_shift');
      const style =
        s === 'external_owner' ? 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d;' :
        s === 'shop_vault' ? 'background:#e0e7ff;color:#3730a3;border:1px solid #a5b4fc;' :
        s === 'bank_ccp' ? 'background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;' :
        'background:#dcfce7;color:#166534;border:1px solid #86efac;';
      const icon = s === 'external_owner' ? '👤' : s === 'shop_vault' ? '🔐' : s === 'bank_ccp' ? '🏦' : '💵';
      return '<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:900;white-space:nowrap;' + style + '">' + icon + ' ' + esc(lbl || 'درج الوردية') + '</span>';
    }

    const QUICK_PRESETS = [
      { label: '🏠 كراء المحل', cat: 'كراء المحل', desc: 'كراء المحل الشهري' },
      { label: '⚡ سونلغاز (كهرباء/غاز)', cat: 'كهرباء وغاز وماء', desc: 'فاتورة الكهرباء والغاز' },
      { label: '💧 المياه (ADE)', cat: 'كهرباء وغاز وماء', desc: 'فاتورة المياه' },
      { label: '🌐 الإنترنت', cat: 'كهرباء وغاز وماء', desc: 'اشتراك الإنترنت الشهري' },
      { label: '👷 سلفة / يومية عامل', cat: 'سلفة عامل', desc: 'سلفة نقدية للعامل' },
      { label: '🚚 نقل وشحن بضاعة', cat: 'نقل وشحن', desc: 'مصاريف نقل وتفريغ سلع' },
      { label: '🏛️ ضرائب (G12/G50/CASNOS)', cat: 'ضرائب ورسوم', desc: 'تسديد ضرائب واشتراكات' },
      { label: '🛍️ أكياس وتغليف ولوازم', cat: 'مصاريف عامة', desc: 'شراء أكياس وورق ولوازم المحل' }
    ];

    const MasterV2 = {
      _installed: true,
      version: '2.1.0-clean-two-tabs',
      activeTab: 'outflows', // outflows | ledger
      filter: {
        scope: 'all',
        dateFrom: new Date().toISOString().slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10),
        sessionId: '',
        fundingSource: 'all',
        kind: 'all',
        search: ''
      },
      ledgerFilter: 'all',
      _state: {
        report: null,
        treasury: null,
        capital: [],
        ledger: []
      },

      async loadAllData() {
        const api = window.api || {};
        const uid = window.AppState?.currentUser?.id || null;
        const [report, treasury, capital, ledger] = await Promise.all([
          typeof api.getUnifiedOutflowsReport === 'function'
            ? api.getUnifiedOutflowsReport({
                scope: this.filter.scope,
                dateFrom: this.filter.dateFrom,
                dateTo: this.filter.dateTo,
                sessionId: this.filter.sessionId || null,
                fundingSource: this.filter.fundingSource,
                search: this.filter.search,
                includeSuppliers: true,
                includePurchases: true,
                includeCaisseOut: true
              }).catch(() => null)
            : Promise.resolve(null),
          typeof api.getTreasuryStatus === 'function'
            ? api.getTreasuryStatus(uid).catch(() => null)
            : Promise.resolve(null),
          typeof api.getCapital === 'function'
            ? api.getCapital().catch(() => [])
            : Promise.resolve([]),
          typeof api.getTreasuryLedger === 'function'
            ? api.getTreasuryLedger({ sourceType: this.ledgerFilter }).catch(() => [])
            : Promise.resolve([])
        ]);

        this._state = {
          report: report || {
            periodLabel: 'جميع الفترات',
            items: [],
            totals: { grandTotal: 0, expensesTotal: 0, workersTotal: 0, suppliersTotal: 0, purchasesTotal: 0, cashOutTotal: 0, count: 0 },
            byFundingSource: { active_shift: 0, shop_vault: 0, bank_ccp: 0, external_owner: 0 },
            byCategory: [],
            sessions: []
          },
          treasury: treasury || { hasOpenShift: false, sessionId: null, drawerExpectedCash: 0, vaultBalance: 0, externalPaidInShift: 0 },
          capital: Array.isArray(capital) ? capital : [],
          ledger: Array.isArray(ledger) ? ledger : []
        };
        return this._state;
      },

      getVisibleItems() {
        const raw = (this._state.report && this._state.report.items) || [];
        if (this.filter.kind === 'all') return raw;
        return raw.filter((x) => x.kind === this.filter.kind);
      },

      buildTab1Html() {
        const rep = this._state.report;
        const tr = this._state.treasury;
        const bfs = rep.byFundingSource || {};
        const items = this.getVisibleItems();
        const visibleTotal = items.reduce((a, b) => a + Number(b.amount || 0), 0);
        const capList = this._state.capital || [];
        const capNet = capList.reduce((acc, c) => acc + (/مسحوبات/.test(c.category || '') ? -Math.abs(Number(c.amount || 0)) : Math.abs(Number(c.amount || 0))), 0);

        const shiftOpts = (rep.sessions || []).map((s) =>
          '<option value="' + Number(s.id) + '"' + (String(this.filter.sessionId) === String(s.id) ? ' selected' : '') + '>وردية #' + Number(s.id) + ' — ' + esc(s.user_name || 'كاشير') + ' (' + esc(String(s.opened_at || '').slice(0, 10)) + ')</option>'
        ).join('');

        const presetsHtml = QUICK_PRESETS.map((p, idx) =>
          '<button type="button" data-mexp-preset="' + idx + '" class="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-bold transition">' + esc(p.label) + '</button>'
        ).join('');

        const rowsHtml = items.length === 0
          ? '<div class="py-12 text-center text-slate-400 font-bold text-sm">لا توجد مصاريف أو مدفوعات مسجّلة في هذا النطاق.</div>'
          : items.map((it, idx) => {
              const isDeletableExp = it.kind === 'expense' || it.kind === 'worker_advance';
              return (
                '<div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 flex flex-wrap items-center justify-between gap-3 hover:border-blue-400 transition">' +
                  '<div class="flex-1 min-w-[230px] space-y-1">' +
                    '<div class="flex items-center gap-2 flex-wrap">' +
                      '<span class="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10.5px] font-black">' + esc(it.category) + '</span>' +
                      srcBadgeHtml(it.fundingSource, it.fundingLabel) +
                      '<span class="font-black text-xs text-slate-900 dark:text-white">' + esc(it.beneficiary) + '</span>' +
                      '<span class="text-xs text-slate-500 dark:text-slate-300 font-bold">— ' + esc(it.description) + '</span>' +
                    '</div>' +
                    '<div class="text-[10.5px] text-slate-400 font-mono flex items-center gap-3">' +
                      '<span>#' + esc(it.docRef) + '</span>' +
                      '<span>📅 ' + esc(it.date) + ' ' + esc(it.time) + '</span>' +
                      (it.sessionId ? '<span class="text-emerald-600 font-bold">وردية #' + Number(it.sessionId) + '</span>' : '') +
                    '</div>' +
                  '</div>' +
                  '<div class="flex items-center gap-2">' +
                    '<div class="text-left ml-2">' +
                      '<div class="font-mono font-black text-sm text-rose-600">-' + fmtDzd(it.amount) + '</div>' +
                      '<div class="text-[10px] text-slate-400 font-bold">' + esc(it.kindLabel) + '</div>' +
                    '</div>' +
                    '<button type="button" data-mexp-v80="' + idx + '" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-900 hover:text-white text-[11px] font-black transition" title="طباعة سند 80mm">🧾 80mm</button>' +
                    '<button type="button" data-mexp-va4="' + idx + '" class="px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white text-[11px] font-black transition" title="طباعة سند A4">📄 A4</button>' +
                    (isDeletableExp ? '<button type="button" data-mexp-del="' + Number(it.rawId) + '" class="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/15 transition" title="حذف المصروف">🗑️</button>' : '') +
                  '</div>' +
                '</div>'
              );
            }).join('');

        const catsHtml = (rep.byCategory || []).length === 0
          ? '<div class="text-xs text-slate-400 text-center py-4">لا توجد بيانات فئات في هذا النطاق</div>'
          : (rep.byCategory || []).map((c) => (
              '<div class="space-y-1 py-1.5 border-b border-slate-100 dark:border-slate-700/60">' +
                '<div class="flex justify-between text-xs font-bold">' +
                  '<span class="text-slate-700 dark:text-slate-200">' + esc(c.category) + ' <span class="text-[10px] text-slate-400">(' + Number(c.count) + ')</span></span>' +
                  '<span class="font-mono font-black text-rose-600">' + fmtDzd(c.total) + ' <span class="text-[10px] text-slate-400">(' + Number(c.pct) + '%)</span></span>' +
                '</div>' +
                '<div class="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div style="width:' + Math.min(100, Number(c.pct || 0)) + '%;" class="h-full bg-rose-500 rounded-full"></div></div>' +
              '</div>'
            )).join('');

        const capRowsHtml = capList.length === 0
          ? '<div class="text-xs text-slate-400 text-center py-5">لا توجد حركات رأس مال أو مسحوبات شركاء مسجّلة.</div>'
          : capList.slice(0, 15).map((c) => {
              const isOut = /مسحوبات/.test(c.category || '');
              return (
                '<div class="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 text-xs">' +
                  '<div><div class="font-black">' + esc(c.category) + '</div><div class="text-[10.5px] text-slate-400">' + esc(c.description || '-') + ' • ' + esc(c.date || '') + '</div></div>' +
                  '<div class="flex items-center gap-2"><span class="font-mono font-black ' + (isOut ? 'text-rose-600' : 'text-emerald-600') + '">' + (isOut ? '-' : '+') + fmtDzd(c.amount) + '</span>' +
                  '<button type="button" data-mexp-del-cap="' + Number(c.id) + '" class="text-rose-500 hover:opacity-75">🗑️</button></div>' +
                '</div>'
              );
            }).join('');

        return (
          '<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">' +
            '<div class="p-4 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 text-white shadow-lg">' +
              '<div class="text-xs font-bold opacity-90">إجمالي الأموال الخارجة (' + esc(rep.periodLabel) + ')</div>' +
              '<div class="text-2xl font-black font-mono mt-1">' + fmtDzd(visibleTotal) + '</div>' +
              '<div class="text-[11px] font-bold opacity-90 mt-1">🇩🇿 ' + esc(fmtCent(visibleTotal)) + ' • ' + items.length + ' عملية</div>' +
            '</div>' +
            '<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
              '<div class="flex items-center justify-between text-xs font-bold text-slate-500"><span>💵 درج الوردية المفتوحة</span>' +
                (tr.hasOpenShift
                  ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-black">🟢 وردية #' + tr.sessionId + '</span>'
                  : '<button type="button" data-mexp-act="open-shift" class="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">🔓 فتح وردية</button>') +
              '</div>' +
              '<div class="text-xl font-black font-mono text-emerald-600 mt-1">' + (tr.hasOpenShift ? fmtDzd(tr.drawerExpectedCash) : 'الوردية مغلقة') + '</div>' +
              '<div class="text-[11px] text-slate-500 font-bold mt-1">صُرف من الدرج بالنطاق: <b class="text-rose-600">' + fmtDzd(bfs.active_shift || 0) + '</b></div>' +
            '</div>' +
            '<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
              '<div class="text-xs font-bold text-slate-500">🔐 الخزينة الرئيسية (Coffre-Fort)</div>' +
              '<div class="text-xl font-black font-mono text-indigo-600 mt-1">' + fmtDzd(tr.vaultBalance || 0) + '</div>' +
              '<div class="text-[11px] text-slate-500 font-bold mt-1">صُرف من الخزينة بالنطاق: <b class="text-indigo-600">' + fmtDzd(bfs.shop_vault || 0) + '</b></div>' +
            '</div>' +
            '<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
              '<div class="text-xs font-bold text-slate-500">👤 تمويل خارجي + 🏦 بنكي/CCP</div>' +
              '<div class="text-xl font-black font-mono text-amber-600 mt-1">' + fmtDzd(Number(bfs.external_owner || 0) + Number(bfs.bank_ccp || 0)) + '</div>' +
              '<div class="text-[11px] text-slate-500 font-bold mt-1">خارجي: <b>' + fmtDzd(bfs.external_owner || 0) + '</b> | بنكي: <b>' + fmtDzd(bfs.bank_ccp || 0) + '</b></div>' +
            '</div>' +
          '</div>' +

          '<div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-3 flex flex-wrap items-center gap-1.5">' +
            '<span class="text-xs font-black text-slate-600 dark:text-slate-300 ml-2">⚡ تسجيل سريع:</span>' +
            presetsHtml +
          '</div>' +

          '<div class="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-3 flex flex-wrap items-center gap-2 text-xs font-bold">' +
            '<select id="mexpScopeSel" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">' +
              '<option value="today"' + (this.filter.scope === 'today' ? ' selected' : '') + '>📅 اليوم فقط</option>' +
              '<option value="yesterday"' + (this.filter.scope === 'yesterday' ? ' selected' : '') + '>📅 الأمس</option>' +
              '<option value="week"' + (this.filter.scope === 'week' ? ' selected' : '') + '>📅 آخر 7 أيام</option>' +
              '<option value="month"' + (this.filter.scope === 'month' ? ' selected' : '') + '>📅 هذا الشهر</option>' +
              '<option value="range"' + (this.filter.scope === 'range' ? ' selected' : '') + '>📅 فترة مخصصة</option>' +
              '<option value="shift"' + (this.filter.scope === 'shift' ? ' selected' : '') + '>🔄 حسب وردية محددة</option>' +
              '<option value="all"' + (this.filter.scope === 'all' ? ' selected' : '') + '>📋 جميع الفترات</option>' +
            '</select>' +
            (this.filter.scope === 'range'
              ? '<input id="mexpDateFrom" type="date" value="' + esc(this.filter.dateFrom) + '" class="px-2.5 py-1.5 rounded-xl border font-mono"><input id="mexpDateTo" type="date" value="' + esc(this.filter.dateTo) + '" class="px-2.5 py-1.5 rounded-xl border font-mono">'
              : '') +
            (this.filter.scope === 'shift'
              ? '<select id="mexpShiftSel" class="px-3 py-2 rounded-xl border border-blue-400 font-bold"><option value="">-- اختر الوردية --</option>' + shiftOpts + '</select>'
              : '') +
            '<select id="mexpSourceSel" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">' +
              '<option value="all"' + (this.filter.fundingSource === 'all' ? ' selected' : '') + '>🏦 كل مصادر المال</option>' +
              '<option value="active_shift"' + (this.filter.fundingSource === 'active_shift' ? ' selected' : '') + '>💵 درج الوردية</option>' +
              '<option value="shop_vault"' + (this.filter.fundingSource === 'shop_vault' ? ' selected' : '') + '>🔐 الخزينة الرئيسية</option>' +
              '<option value="bank_ccp"' + (this.filter.fundingSource === 'bank_ccp' ? ' selected' : '') + '>🏦 بنك / CCP / شيك</option>' +
              '<option value="external_owner"' + (this.filter.fundingSource === 'external_owner' ? ' selected' : '') + '>👤 مال خارجي / المالك</option>' +
            '</select>' +
            '<select id="mexpKindSel" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">' +
              '<option value="all"' + (this.filter.kind === 'all' ? ' selected' : '') + '>📊 الكل (مصاريف + سلف + موردين + مشتريات)</option>' +
              '<option value="expense"' + (this.filter.kind === 'expense' ? ' selected' : '') + '>💸 المصاريف التشغيلية فقط</option>' +
              '<option value="worker_advance"' + (this.filter.kind === 'worker_advance' ? ' selected' : '') + '>👷 رواتب وسلف العمال فقط</option>' +
              '<option value="supplier_payment"' + (this.filter.kind === 'supplier_payment' ? ' selected' : '') + '>🚚 تسديدات وتسبقات الموردين فقط</option>' +
              '<option value="purchase_payment"' + (this.filter.kind === 'purchase_payment' ? ' selected' : '') + '>🛍️ دفعات فواتير الشراء فقط</option>' +
            '</select>' +
            '<input id="mexpSearchInp" type="text" value="' + esc(this.filter.search) + '" placeholder="🔍 ابحث بالمستفيد، الفئة، البيان..." class="flex-1 min-w-[180px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">' +
          '</div>' +

          '<div class="grid grid-cols-1 lg:grid-cols-12 gap-4">' +
            '<div class="lg:col-span-8 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">' +
              '<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">' +
                '<h3 class="font-black text-sm text-rose-600">📋 السجل الموحّد للمصاريف والأموال الخارجة (' + items.length + ')</h3>' +
                '<span class="font-mono font-black text-xs text-slate-600 dark:text-slate-300">المجموع: ' + fmtDzd(visibleTotal) + '</span>' +
              '</div>' +
              '<div class="space-y-2 max-h-[52vh] overflow-y-auto pr-1">' + rowsHtml + '</div>' +
            '</div>' +
            '<div class="lg:col-span-4 space-y-4">' +
              '<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
                '<h3 class="font-black text-sm text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">🗂️ توزيع المصاريف حسب الفئة (حقيقي 100%)</h3>' +
                '<div class="max-h-56 overflow-y-auto">' + catsHtml + '</div>' +
              '</div>' +
              '<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
                '<div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">' +
                  '<h3 class="font-black text-sm text-emerald-600">🏛️ حركات رأس المال (' + capList.length + ')</h3>' +
                  '<span class="font-mono text-xs font-black text-indigo-600">' + fmtDzd(capNet) + '</span>' +
                '</div>' +
                '<div class="max-h-48 overflow-y-auto">' + capRowsHtml + '</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      },

      buildTab2LedgerHtml() {
        const rows = this._state.ledger || [];
        const bodyRows = rows.length === 0
          ? '<tr><td colspan="6" class="py-10 text-center text-slate-400 font-bold">لا توجد حركات مسجّلة في دفتر الخزائن لهذا الفلتر بعد.</td></tr>'
          : rows.map((r, i) => (
              '<tr class="border-b border-slate-100 dark:border-slate-700 text-xs">' +
                '<td class="p-2.5 font-mono text-center">' + (i + 1) + '</td>' +
                '<td class="p-2.5 font-mono">' + esc(r.date || String(r.created_at || '').slice(0, 10)) + '</td>' +
                '<td class="p-2.5">' + srcBadgeHtml(r.source_type, r.payer_name || r.source_type) + '</td>' +
                '<td class="p-2.5 font-black">' + esc(r.party_name || r.category) + '</td>' +
                '<td class="p-2.5 text-slate-600 dark:text-slate-300">' + esc(r.notes || '-') + '</td>' +
                '<td class="p-2.5 font-mono font-black ' + (r.direction === 'in' ? 'text-emerald-600' : 'text-rose-600') + '">' + (r.direction === 'in' ? '+' : '-') + fmtDzd(r.amount) + '</td>' +
              '</tr>'
            )).join('');

        return (
          '<div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">' +
            '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">' +
              '<h3 class="font-black text-sm text-blue-600">🏦 دفتر حركات الخزائن الأربعة الحي (Treasury Ledger — ' + rows.length + ')</h3>' +
              '<select id="mexpLedgerSrcSel" class="px-3 py-1.5 rounded-xl border text-xs font-bold">' +
                '<option value="all"' + (this.ledgerFilter === 'all' ? ' selected' : '') + '>كل الخزائن</option>' +
                '<option value="active_shift"' + (this.ledgerFilter === 'active_shift' ? ' selected' : '') + '>💵 درج الوردية</option>' +
                '<option value="shop_vault"' + (this.ledgerFilter === 'shop_vault' ? ' selected' : '') + '>🔐 الخزينة الرئيسية</option>' +
                '<option value="bank_ccp"' + (this.ledgerFilter === 'bank_ccp' ? ' selected' : '') + '>🏦 بنك / CCP</option>' +
                '<option value="external_owner"' + (this.ledgerFilter === 'external_owner' ? ' selected' : '') + '>👤 مال خارجي / المالك</option>' +
              '</select>' +
            '</div>' +
            '<div class="overflow-x-auto max-h-[60vh]"><table class="w-full text-right"><thead><tr class="bg-slate-50 dark:bg-slate-900 text-xs text-slate-500"><th class="p-2.5">#</th><th class="p-2.5">التاريخ</th><th class="p-2.5">مصدر المال / الدافع</th><th class="p-2.5">المستفيد / الطرف</th><th class="p-2.5">البيان</th><th class="p-2.5">المبلغ</th></tr></thead><tbody>' + bodyRows + '</tbody></table></div>' +
          '</div>'
        );
      },

      async render() {
        const root = document.getElementById('expenses-view-root');
        if (!root) return false;

        await this.loadAllData();
        const totalOutCount = ((this._state.report && this._state.report.items) || []).length;

        const tabBtnCls = (key) =>
          this.activeTab === key
            ? 'px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs shadow-md'
            : 'px-4 py-2 rounded-xl bg-slate-800/80 text-slate-200 hover:bg-slate-700 font-bold text-xs';

        root.innerHTML =
          '<div id="gherbiMasterExpensesPageV2" class="space-y-3 pb-6" style="direction:rtl;">' +
            '<div class="p-2.5 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shadow">' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<button type="button" data-mexp-tab="outflows" class="' + tabBtnCls('outflows') + '">💸 1. المصاريف والأموال الخارجة الموحّدة (' + totalOutCount + ')</button>' +
                '<button type="button" data-mexp-tab="ledger" class="' + tabBtnCls('ledger') + '">🏦 2. دفتر الخزائن الأربعة (' + (this._state.ledger || []).length + ')</button>' +
              '</div>' +
              '<button type="button" data-mexp-act="refresh" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-black">🔄 تحديث حي</button>' +
            '</div>' +

            '<div class="flex flex-wrap items-center justify-between gap-3">' +
              '<div>' +
                '<h2 class="text-xl font-black text-slate-900 dark:text-white">المصاريف التشغيلية، الخزائن، والأموال الخارجة الموحّدة</h2>' +
                '<p class="text-xs text-slate-500 font-bold">إدارة موحّدة لكل ما يخرج من المتجر مع ربط مباشر بالموردين والمشتريات ومركز الطباعة (80mm / A4)</p>' +
              '</div>' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<button type="button" data-mexp-act="new-expense" class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow">+ تسجيل مصروف / سلفة (Alt+N)</button>' +
                '<button type="button" data-mexp-act="pay-supplier" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black">🚚 تسديد / تسبقة مورد</button>' +
                '<button type="button" data-mexp-act="pay-purchase" class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black">🛍️ تسديد فاتورة شراء</button>' +
                '<button type="button" data-mexp-act="new-capital" class="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black">+ رأس مال</button>' +
                '<button type="button" data-mexp-act="print-report" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow">🖨️ التقرير النهائي (80mm / A4)</button>' +
                '<button type="button" data-mexp-act="open-studio" class="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 text-rose-600 text-xs font-black">🎨 قوالب السندات</button>' +
              '</div>' +
            '</div>' +

            (this.activeTab === 'ledger' ? this.buildTab2LedgerHtml() : this.buildTab1Html()) +
          '</div>';

        this.bindEvents(root);
        return true;
      },

      bindEvents(root) {
        const self = this;
        const page = root.querySelector('#gherbiMasterExpensesPageV2');
        if (!page) return;

        page.addEventListener('click', async (ev) => {
          const tabBtn = ev.target.closest && ev.target.closest('[data-mexp-tab]');
          if (tabBtn) {
            self.activeTab = tabBtn.getAttribute('data-mexp-tab');
            await self.render();
            return;
          }

          const presetBtn = ev.target.closest && ev.target.closest('[data-mexp-preset]');
          if (presetBtn) {
            const p = QUICK_PRESETS[Number(presetBtn.getAttribute('data-mexp-preset'))];
            if (p && window.App?.openModal) {
              window.App.openModal('expenseModal');
              setTimeout(() => {
                const cat = document.getElementById('expCategoryInput');
                const desc = document.getElementById('expDescInput');
                if (cat) cat.value = p.cat;
                if (desc) desc.value = p.desc;
                window.GherbiTreasuryStage6B?.hydrateExpenseModal?.(p.cat);
              }, 30);
            }
            return;
          }

          const v80 = ev.target.closest && ev.target.closest('[data-mexp-v80]');
          const va4 = ev.target.closest && ev.target.closest('[data-mexp-va4]');
          if (v80 || va4) {
            const idx = Number((v80 || va4).getAttribute(v80 ? 'data-mexp-v80' : 'data-mexp-va4'));
            const it = self.getVisibleItems()[idx];
            if (it && window.GherbiExpensesHubStage6B2) {
              await window.GherbiExpensesHubStage6B2.printSingleVoucher(it, va4 ? 'a4' : '80mm', { asPdf: false });
            }
            return;
          }

          const delExp = ev.target.closest && ev.target.closest('[data-mexp-del]');
          if (delExp) {
            const id = Number(delExp.getAttribute('data-mexp-del'));
            if (id && window.api?.deleteExpense) {
              await window.api.deleteExpense(id);
              window.App?.showToast?.('🗑️ تم حذف المصروف وتحديث الأرصدة.', 'success');
              await self.render();
            }
            return;
          }

          const delCap = ev.target.closest && ev.target.closest('[data-mexp-del-cap]');
          if (delCap) {
            const id = Number(delCap.getAttribute('data-mexp-del-cap'));
            if (id && window.api?.deleteCapital) {
              await window.api.deleteCapital(id);
              window.App?.showToast?.('🗑️ تم حذف حركة رأس المال.', 'success');
              await self.render();
            }
            return;
          }

          const actBtn = ev.target.closest && ev.target.closest('[data-mexp-act]');
          if (!actBtn) return;
          const act = actBtn.getAttribute('data-mexp-act');

          if (act === 'refresh') {
            await self.render();
          } else if (act === 'new-expense') {
            window.App?.openModal?.('expenseModal');
            window.GherbiTreasuryStage6B?.hydrateExpenseModal?.();
          } else if (act === 'new-capital') {
            window.App?.openModal?.('capitalModal');
          } else if (act === 'open-shift') {
            window.App?.openModal?.('openShiftModal');
          } else if (act === 'pay-supplier') {
            await window.GherbiExpensesHubStage6B2?.openQuickSupplierPayPicker?.();
          } else if (act === 'pay-purchase') {
            await window.GherbiExpensesHubStage6B2?.openQuickPurchasePayPicker?.();
          } else if (act === 'print-report') {
            if (window.GherbiExpensesHubStage6B2) {
              window.GherbiExpensesHubStage6B2._hubFilter = Object.assign({}, window.GherbiExpensesHubStage6B2._hubFilter, self.filter);
              await window.GherbiExpensesHubStage6B2.openOutflowsReportStudioModal();
            }
          } else if (act === 'open-studio') {
            window.GherbiPrintStudioPro?.state?.setActiveDoc?.('expenses_period_report_a4');
            window.App?.switchView?.('print');
          }
        });

        page.querySelector('#mexpScopeSel')?.addEventListener('change', (e) => { self.filter.scope = e.target.value; self.render(); });
        page.querySelector('#mexpDateFrom')?.addEventListener('change', (e) => { self.filter.dateFrom = e.target.value; self.render(); });
        page.querySelector('#mexpDateTo')?.addEventListener('change', (e) => { self.filter.dateTo = e.target.value; self.render(); });
        page.querySelector('#mexpShiftSel')?.addEventListener('change', (e) => { self.filter.sessionId = e.target.value; self.render(); });
        page.querySelector('#mexpSourceSel')?.addEventListener('change', (e) => { self.filter.fundingSource = e.target.value; self.render(); });
        page.querySelector('#mexpKindSel')?.addEventListener('change', (e) => { self.filter.kind = e.target.value; self.render(); });
        page.querySelector('#mexpLedgerSrcSel')?.addEventListener('change', (e) => { self.ledgerFilter = e.target.value; self.render(); });

        const searchInp = page.querySelector('#mexpSearchInp');
        if (searchInp) {
          let st = null;
          searchInp.addEventListener('input', (e) => {
            self.filter.search = e.target.value;
            clearTimeout(st);
            st = setTimeout(() => self.render(), 220);
          });
        }
      },

      installLocks() {
        const self = this;
        const app = window.App;
        if (!app || app._masterExpensesV2Locked) return false;
        app._masterExpensesV2Locked = true;

        app.loadExpensesView = () => self.render();
        if (window.GherbiExpensesTurbo) {
          window.GherbiExpensesTurbo.render = () => self.render();
        }

        if (typeof app.switchView === 'function') {
          const origSwitch = app.switchView.bind(app);
          app.switchView = async function s6b3SwitchView(viewName, ...rest) {
            const out = await origSwitch(viewName, ...rest);
            if (viewName === 'expenses') {
              setTimeout(() => self.render(), 25);
            }
            return out;
          };
        }

        if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
          const expRoot = document.getElementById('expenses-view-root');
          if (expRoot && !expRoot._masterV2Guard) {
            expRoot._masterV2Guard = true;
            let guardT = null;
            const obs = new MutationObserver(() => {
              const sec = document.getElementById('view-expenses');
              if (sec && sec.classList.contains('active') && !expRoot.querySelector('#gherbiMasterExpensesPageV2')) {
                clearTimeout(guardT);
                guardT = setTimeout(() => self.render(), 30);
              }
            });
            obs.observe(expRoot, { childList: true });
          }
        }
        return true;
      },

      boot() {
        this.installLocks();
        let tries = 0;
        const iv = setInterval(() => {
          tries++;
          if (this.installLocks() || tries >= 40) clearInterval(iv);
        }, 120);
        console.log('🛡️ [GHERBI EXPENSES MASTER V2]: صفحة المصاريف الموحّدة (تبويبان نظيفان) جاهزة 100%.');
      }
    };

    window.GherbiExpensesMasterV2 = MasterV2;
    MasterV2.boot();
  })();
})();
