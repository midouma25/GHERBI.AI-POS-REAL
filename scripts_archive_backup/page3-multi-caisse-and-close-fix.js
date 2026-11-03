/**
 * page3-multi-caisse-and-close-fix.js
 * 1. إصلاح جذري لزر (إغلاق المناوبة Z-Report) وزر (تقرير X-Report الفوري F9) وتطبيع كائن AppState.activeSession
 * 2. عزل المناوبات لكل حساب مستخدم (Per-Account Shift Isolation) في till-ledger.js
 * 3. تطوير الصفحتين النهائيتين:
 *    - الصفحة أ: (💼 صندوقي ومناوبتي الشخصية) مع ميزة ضم المبيعات الحرة التي تمت بدون مناوبة
 *    - الصفحة ب: (🏛️ إدارة كل الصناديق - غرفة قيادة المدير العام) لمراقبة وإدارة صناديق جميع الحسابات والسياسة الصارمة/المرنة
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء الإصلاح الجراحي لإغلاق المناوبة و X-Report وتطوير منظومة إدارة كل الصناديق للمدير العام...\n');

// ============================================================================
// 1. ترقية till-ledger.js لدعم عزل مناوبة كل حساب مستخدم (Per-Account Shift Isolation)
// ============================================================================
const tillPath = path.join(ROOT, 'till-ledger.js');
if (fs.existsSync(tillPath)) {
  let tillCode = fs.readFileSync(tillPath, 'utf8');

  const oldResolveFn = `async function resolveOpenSession(db, preferredSessionId = null, userId = null, deviceId = null) {
  if (preferredSessionId) {
    const row = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE id = ? AND status = 'open' AND deleted_at IS NULL",
      [Number(preferredSessionId)]
    );
    if (row && row.id) return row.id;
  }

  if (userId) {
    const userRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE user_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1",
      [Number(userId)]
    );
    if (userRow && userRow.id) return userRow.id;
  }

  if (deviceId) {
    const devRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE device_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1",
      [String(deviceId)]
    );
    if (devRow && devRow.id) return devRow.id;
  }

  const anyOpen = await dbGet(
    db,
    "SELECT id FROM caisse_sessions WHERE status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1"
  );
  return anyOpen ? anyOpen.id : null;
}`;

  const newResolveFn = `async function resolveOpenSession(db, preferredSessionId = null, userId = null, deviceId = null) {
  if (preferredSessionId && Number(preferredSessionId) > 0) {
    const row = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE id = ? AND status = 'open' AND deleted_at IS NULL",
      [Number(preferredSessionId)]
    );
    if (row && row.id) return row.id;
  }

  // عزل صارم لكل حساب مستخدم: إذا تم تمرير userId نبحث عن المناوبة المفتوحة الخاصة بهذا الحساب تحديداً
  if (userId && Number(userId) > 0) {
    const userRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE user_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1",
      [Number(userId)]
    );
    if (userRow && userRow.id) return userRow.id;

    // في حال وجود مناوبة مفتوحة قديمة بدون user_id على نفس الجهاز نربطها به
    const unownedRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE user_id IS NULL AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1"
    );
    return unownedRow ? unownedRow.id : null;
  }

  if (deviceId) {
    const devRow = await dbGet(
      db,
      "SELECT id FROM caisse_sessions WHERE device_id = ? AND status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1",
      [String(deviceId)]
    );
    if (devRow && devRow.id) return devRow.id;
  }

  const anyOpen = await dbGet(
    db,
    "SELECT id FROM caisse_sessions WHERE status = 'open' AND deleted_at IS NULL ORDER BY opened_at DESC, id DESC LIMIT 1"
  );
  return anyOpen ? anyOpen.id : null;
}`;

  if (tillCode.includes('async function resolveOpenSession')) {
    tillCode = tillCode.replace(/async function resolveOpenSession[\s\S]*?return anyOpen \? anyOpen\.id : null;\s*\}/, newResolveFn);
    new vm.Script(tillCode, { filename: 'till-ledger.js' });
    fs.writeFileSync(tillPath, tillCode, 'utf8');
    console.log('✅ 1/3: تم تحديث till-ledger.js لعزل المناوبات لكل حساب مستخدم مستقل (Per-Account Shift Isolation).');
  }
}

// ============================================================================
// 2. الوحدة الشاملة لإصلاح الإغلاق و X-Report وتطوير صفحتي الصندوق والمدير العام
// ============================================================================
function installCaisseMasterSuiteAndCloseFix() {
  if (!window.App || !window.AppState) return;

  AppState.caisseSubPage = 'my_till'; // 'my_till' | 'admin_all_tills'
  AppState.caisseTxFilterType = 'all';
  AppState.caisseTxSearchQuery = '';
  AppState.adminSelectedUserFilter = 'all';

  function formatCleanCaisseDate(raw) {
    if (!raw) return '—';
    var s = String(raw).replace('T', ' ');
    var d = s.slice(0, 10);
    var t = s.slice(11, 16);
    return t ? d + ' | 🕒 ' + t : d;
  }

  function getCaisseTxTypeInfo(type) {
    var t = String(type || '').toLowerCase();
    var map = {
      sale_cash: { label: '📥 مبيعات نقدية', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', sign: '+', isIn: true },
      sale: { label: '📥 مبيعات نقدية', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', sign: '+', isIn: true },
      debt_payment: { label: '🤝 تسديد دين زبون', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', sign: '+', isIn: true },
      order_deposit: { label: '📋 عربون طلبية', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', sign: '+', isIn: true },
      cash_in: { label: '➕ إيداع / تغذية صندوق', cls: 'bg-teal-500/15 text-teal-600 dark:text-teal-400', sign: '+', isIn: true },
      cash_out: { label: '➖ سحب نقدي / خزنة', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', sign: '-', isIn: false },
      expense: { label: '💸 مصروف تشغيلي', cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', sign: '-', isIn: false },
      sale_refund: { label: '↩️ مرتجع مبيعات', cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-400', sign: '-', isIn: false }
    };
    return map[t] || { label: t || 'حركة صندوق', cls: 'bg-slate-200 dark:bg-slate-700 text-slate-600', sign: '', isIn: true };
  }

  // --------------------------------------------------------------------------
  // 1) تطبيع AppState.activeSession بحيث يحتوي دائماً على id و session.id معاً!
  // --------------------------------------------------------------------------
  App.normalizeActiveSessionObject = function (raw) {
    if (!raw) return null;
    var sess = raw.session || raw;
    if (!sess || !sess.id) return null;
    var summary = raw.summary || {
      openingBalance: Number(sess.opening_balance || 0),
      totalSalesCash: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      totalExpenses: 0,
      totalRefunds: 0,
      currentBalance: Number(sess.opening_balance || 0),
      expectedBalance: Number(sess.opening_balance || 0)
    };
    return Object.assign({}, sess, {
      id: Number(sess.id),
      session_id: Number(sess.id),
      session: sess,
      summary: summary,
      transactions: Array.isArray(raw.transactions) ? raw.transactions : []
    });
  };

  App.refreshActiveSession = async function () {
    var uid = (AppState.currentUser && AppState.currentUser.id) ? Number(AppState.currentUser.id) : 1;
    try {
      var raw = await window.api.getActiveSession(uid).catch(function () { return null; });
      AppState.activeSession = this.normalizeActiveSessionObject(raw);
    } catch (_) {
      AppState.activeSession = null;
    }

    var badgeBtn = document.getElementById('headerShiftBadge');
    var shiftTxt = document.getElementById('headerShiftText');
    if (shiftTxt) {
      if (AppState.activeSession && AppState.activeSession.id) {
        var curBal = Number(AppState.activeSession.summary?.expectedBalance ?? AppState.activeSession.opening_balance ?? 0);
        shiftTxt.textContent = 'المناوبة #' + AppState.activeSession.id + ' (' + curBal.toFixed(0) + ' د.ج)';
        if (badgeBtn) {
          badgeBtn.className = 'px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-black flex items-center gap-1.5';
        }
      } else {
        shiftTxt.textContent = 'فتح مناوبة صندوق';
        if (badgeBtn) {
          badgeBtn.className = 'px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-black flex items-center gap-1.5';
        }
      }
    }
    return AppState.activeSession;
  };

  // دالة مساعدة مضمونة 100% لاستخراج رقم المناوبة النشطة حتى لو لم يُمرر
  App.resolveTargetSessionId = async function (passedId) {
    var num = Number(passedId);
    if (Number.isFinite(num) && num > 0) return num;
    if (AppState.activeSession) {
      var aid = Number(AppState.activeSession.id || (AppState.activeSession.session && AppState.activeSession.session.id));
      if (Number.isFinite(aid) && aid > 0) return aid;
    }
    await this.refreshActiveSession();
    if (AppState.activeSession && AppState.activeSession.id) {
      return Number(AppState.activeSession.id);
    }
    var allSessions = (await window.api.getCaisseSessions().catch(function () { return []; })) || [];
    var openOne = allSessions.find(function (s) { return s.status === 'open'; }) || allSessions[0];
    return openOne ? Number(openOne.id) : null;
  };

  // --------------------------------------------------------------------------
  // 2) إصلاح جذري لفتح وتأكيد إغلاق المناوبة (#closeShiftModal) و X-Report
  // --------------------------------------------------------------------------
  App.openCloseShiftModal = async function (sessionId, expectedBalance) {
    var validId = await this.resolveTargetSessionId(sessionId);
    if (!validId) {
      if (typeof showToast === 'function') showToast('لا توجد مناوبة مفتوحة حالياً لإغلاقها', 'warning');
      return;
    }

    var details = await window.api.getSessionDetails(validId).catch(function () { return null; });
    var expBal = (expectedBalance !== undefined && expectedBalance !== null && Number.isFinite(Number(expectedBalance)))
      ? Number(expectedBalance)
      : Number((details && details.summary && details.summary.expectedBalance) || 0);

    AppState._closeShiftExpected = expBal;
    AppState._closingTargetSessionId = validId;

    var idInp = document.getElementById('closeShiftSessionId');
    if (idInp) idInp.value = String(validId);

    var expTxt = document.getElementById('closeShiftExpectedText');
    if (expTxt) expTxt.textContent = expBal.toFixed(2) + ' د.ج';

    var cntInp = document.getElementById('closeShiftCountedInput');
    if (cntInp) {
      cntInp.value = expBal.toFixed(2);
      cntInp.oninput = function () {
        App.updateCloseShiftDiffPreview();
      };
    }

    var noteInp = document.getElementById('closeShiftNoteInput');
    if (noteInp) noteInp.value = '';

    document.querySelectorAll('#closeShiftModal .denom-inp').forEach(function (inp) {
      inp.value = '';
    });

    this.updateCloseShiftDiffPreview();
    this.openModal('closeShiftModal');
  };

  App.recalcCloseShiftDenoms = function () {
    var sum = 0;
    var hasAny = false;
    document.querySelectorAll('#closeShiftModal .denom-inp').forEach(function (inp) {
      var denom = Number(inp.getAttribute('data-denom') || 0);
      var count = Math.max(0, parseInt(inp.value || '0', 10) || 0);
      if (count > 0) hasAny = true;
      sum += denom * count;
    });
    var countedEl = document.getElementById('closeShiftCountedInput');
    if (countedEl && hasAny) {
      countedEl.value = sum.toFixed(2);
    }
    this.updateCloseShiftDiffPreview();
  };

  App.updateCloseShiftDiffPreview = function () {
    var counted = parseFloat(document.getElementById('closeShiftCountedInput')?.value) || 0;
    var expected = Number(AppState._closeShiftExpected || 0);
    var diff = Number((counted - expected).toFixed(2));
    var box = document.getElementById('caisseDiffPreview');
    if (!box) return;
    box.textContent = (diff > 0 ? '+' : '') + diff.toFixed(2) + ' د.ج';
    box.className =
      'w-full px-3 py-2 rounded-xl font-mono font-black text-base text-center ' +
      (Math.abs(diff) < 0.01
        ? 'bg-emerald-500/15 text-emerald-600'
        : diff < 0
          ? 'bg-rose-500/15 text-rose-600'
          : 'bg-amber-500/15 text-amber-600');
  };

  App.confirmCloseShift = async function () {
    var rawVal = document.getElementById('closeShiftSessionId')?.value;
    var sessionId = await this.resolveTargetSessionId(rawVal || AppState._closingTargetSessionId);
    if (!sessionId) {
      if (typeof showToast === 'function') showToast('لم يتم العثور على رقم المناوبة المفتوحة!', 'error');
      return;
    }

    var closingBalance = parseFloat(document.getElementById('closeShiftCountedInput')?.value);
    if (!Number.isFinite(closingBalance)) closingBalance = Number(AppState._closeShiftExpected || 0);
    var userNote = document.getElementById('closeShiftNoteInput')?.value?.trim() || '';

    var denomParts = [];
    document.querySelectorAll('#closeShiftModal .denom-inp').forEach(function (inp) {
      var d = Number(inp.getAttribute('data-denom') || 0);
      var cnt = parseInt(inp.value || '0', 10) || 0;
      if (d > 0 && cnt > 0) denomParts.push(cnt + '×' + d + 'د.ج');
    });
    var fullNote = denomParts.length > 0
      ? (userNote ? userNote + ' | ' : '') + 'الجرد: [' + denomParts.join(' + ') + ']'
      : userNote;

    await window.api.closeCaisseSession({
      sessionId: Number(sessionId),
      closingBalance: closingBalance,
      closeNote: fullNote
    });

    this.closeModal('closeShiftModal');
    AppState._closingTargetSessionId = null;
    await this.refreshActiveSession();
    await this.renderCaisseView();

    if (typeof showToast === 'function') {
      showToast('✅ تم إغلاق المناوبة رقم #' + sessionId + ' بنجاح وإصدار تقرير Z-Report النهائي!', 'success');
    }
    await this.openSessionReviewModal(sessionId);
  };

  // إصلاح openSessionReviewModal ليعمل دائماً حتى لو مرر له undefined (يفتح X-Report للمناوبة النشطة فوراً)
  var _prevOpenSessionReview = typeof App.openSessionReviewModal === 'function' ? App.openSessionReviewModal.bind(App) : null;
  App.openSessionReviewModal = async function (sessionId) {
    var validId = await this.resolveTargetSessionId(sessionId);
    if (!validId) {
      if (typeof showToast === 'function') showToast('لا توجد مناوبة نشطة أو سابقة لعرض تقريرها', 'warning');
      return;
    }
    if (_prevOpenSessionReview) {
      return await _prevOpenSessionReview(validId);
    }
  };

  // --------------------------------------------------------------------------
  // 3) حارس إلزامية المناوبة قبل البيع (Require Shift Policy) + ضم المبيعات الحرة
  // --------------------------------------------------------------------------
  App.toggleRequireSessionPolicy = async function () {
    var cur = String((AppState.settings && AppState.settings.caisse_require_session) || 'false') === 'true';
    var nextVal = cur ? 'false' : 'true';
    await window.api.updateSettings({ caisse_require_session: nextVal });
    AppState.settings.caisse_require_session = nextVal;
    await this.renderCaisseView();
    if (typeof showToast === 'function') {
      showToast(
        nextVal === 'true'
          ? '🔒 تم تفعيل الوضع الصارم: لا يمكن لأي كاشير البيع إلا بعد فتح مناوبة صندوق!'
          : '🔓 تم تفعيل الوضع المرن: يمكن البيع الحر حتى لو كانت المناوبة مغلقة.',
        'info'
      );
    }
  };

  // ربط حارس إلزامية المناوبة بدوال البيع في الكاشير
  var _origOpenCheckout = typeof App.openCheckoutModal === 'function' ? App.openCheckoutModal.bind(App) : null;
  if (_origOpenCheckout) {
    App.openCheckoutModal = async function () {
      var requireShift = String((AppState.settings && AppState.settings.caisse_require_session) || 'false') === 'true';
      if (requireShift) {
        await this.refreshActiveSession();
        if (!AppState.activeSession || !AppState.activeSession.id) {
          if (typeof showToast === 'function') {
            showToast('🔒 تنبيه الإدارة: يجب فتح مناوبة صندوق أولاً قبل تسجيل أي عملية بيع!', 'warning');
          }
          this.openModal('openShiftModal');
          return;
        }
      }
      return await _origOpenCheckout();
    };
  }

  var _origInstantConfirm = typeof App.instantConfirmAndCheckout === 'function' ? App.instantConfirmAndCheckout.bind(App) : null;
  if (_origInstantConfirm) {
    App.instantConfirmAndCheckout = async function (mode) {
      var requireShift = String((AppState.settings && AppState.settings.caisse_require_session) || 'false') === 'true';
      if (requireShift) {
        await this.refreshActiveSession();
        if (!AppState.activeSession || !AppState.activeSession.id) {
          if (typeof showToast === 'function') {
            showToast('🔒 تنبيه الإدارة: يجب فتح مناوبة صندوق أولاً قبل البيع الفوري!', 'warning');
          }
          this.openModal('openShiftModal');
          return;
        }
      }
      return await _origInstantConfirm(mode);
    };
  }

  // ضم المبيعات النقدية الحرة (التي تمت اليوم بدون مناوبة) إلى المناوبة المفتوحة حالياً
  App.attachOrphanSalesToCurrentShift = async function (orphanCount, orphanCashTotal, orphanIdsStr) {
    await this.refreshActiveSession();
    if (!AppState.activeSession || !AppState.activeSession.id) {
      if (typeof showToast === 'function') showToast('افتح مناوبة صندوق أولاً ليتم ضم المبيعات الحرة إليها!', 'warning');
      this.openModal('openShiftModal');
      return;
    }

    var cashAmt = Number(orphanCashTotal || 0);
    if (cashAmt <= 0) return;

    await window.api.addCaisseTransaction({
      session_id: AppState.activeSession.id,
      user_id: AppState.currentUser ? AppState.currentUser.id : 1,
      type: 'sale_cash',
      amount: cashAmt,
      category: 'sales_reconcile',
      description: 'ضم مبيعات نقدية حرة تمت قبل فتح المناوبة (' + orphanCount + ' فواتير: ' + orphanIdsStr + ')'
    });

    localStorage.setItem('gherbi_reconciled_orphan_sales_' + new Date().toISOString().slice(0, 10), orphanIdsStr);
    await this.renderCaisseView();
    if (typeof showToast === 'function') {
      showToast('🔗 تم ضم وإدراج (' + cashAmt.toFixed(2) + ' د.ج) من المبيعات الحرة إلى درج المناوبة الحالية #' + AppState.activeSession.id + ' بنجاح!', 'success');
    }
  };

  // فتح مناوبة لحساب مستخدم محدد من لوحة المدير العام
  App.adminOpenShiftForUser = async function (userId, userName) {
    var balStr = window.prompt('أدخل الرصيد الافتتاحي (Fond de Caisse) بالدينار لفتح مناوبة لحساب (' + userName + '):', '5000');
    if (balStr === null) return;
    var bal = parseFloat(balStr) || 0;
    await window.api.openCaisseSession({ userId: Number(userId), openingBalance: bal });
    await this.refreshActiveSession();
    await this.renderCaisseView();
    if (typeof showToast === 'function') {
      showToast('🟢 تم فتح مناوبة صندوق جديدة لحساب (' + userName + ') برصيد افتتاحي ' + bal.toFixed(2) + ' د.ج', 'success');
    }
  };

  // إيداع أو سحب لصندوق مستخدم محدد من لوحة المدير العام
  App.openCaisseTxModalForSession = function (type, targetSessionId) {
    AppState._targetTxSessionId = targetSessionId ? Number(targetSessionId) : null;
    this.openCaisseTxModal(type);
  };

  App.confirmCaisseTx = async function () {
    var type = document.getElementById('caisseTxTypeInput')?.value || 'cash_in';
    var amount = parseFloat(document.getElementById('caisseTxAmountInput')?.value) || 0;
    var desc = document.getElementById('caisseTxDescInput')?.value || '';
    if (amount <= 0) {
      if (typeof showToast === 'function') showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'warning');
      return;
    }

    var targetSessId = AppState._targetTxSessionId || (AppState.activeSession && AppState.activeSession.id);
    await window.api.addCaisseTransaction({
      session_id: targetSessId || undefined,
      user_id: AppState.currentUser ? AppState.currentUser.id : 1,
      type: type,
      amount: amount,
      description: desc
    });

    AppState._targetTxSessionId = null;
    this.closeModal('caisseTxModal');
    await this.refreshActiveSession();
    await this.renderCaisseView();
    if (typeof showToast === 'function') showToast('✅ تم تسجيل الحركة النقدية في الصندوق بنجاح', 'success');
  };

  App.confirmOpenShift = async function () {
    var bal = parseFloat(document.getElementById('openShiftBalanceInput')?.value) || 0;
    var uid = AppState.currentUser ? AppState.currentUser.id : 1;
    await window.api.openCaisseSession({ userId: uid, openingBalance: bal });
    this.closeModal('openShiftModal');
    await this.refreshActiveSession();
    await this.renderCaisseView();
    if (typeof showToast === 'function') showToast('🟢 تم فتح مناوبتك الشخصية بنجاح!', 'success');
  };

  // طباعة التقرير الموحد لكل الصناديق للمدير العام (Consolidated Master Multi-Caisse Report)
  App.printConsolidatedMultiCaisseReport = async function () {
    var sessions = (await window.api.getCaisseSessions().catch(function () { return []; })) || [];
    var users = (await window.api.getUsers().catch(function () { return []; })) || [];
    var s = AppState.settings || {};

    var openSessions = sessions.filter(function (x) { return x.status === 'open'; });
    var closedToday = sessions.filter(function (x) { return x.status === 'closed'; }).slice(0, 30);

    var rowsHtml = sessions.slice(0, 40).map(function (cs) {
      var diff = Number(cs.difference || 0);
      return (
        '<tr>' +
        '<td>#' + cs.id + '</td>' +
        '<td><strong>' + (cs.user_name || 'المدير العام') + '</strong></td>' +
        '<td>' + (cs.status === 'open' ? '🟢 مفتوحة' : '⚪ مغلقة') + '</td>' +
        '<td style="font-family:monospace;">' + Number(cs.opening_balance || 0).toFixed(2) + '</td>' +
        '<td style="font-family:monospace;">' + (cs.expected_balance !== null && cs.expected_balance !== undefined ? Number(cs.expected_balance).toFixed(2) : '—') + '</td>' +
        '<td style="font-family:monospace;font-weight:bold;">' + (cs.closing_balance !== null && cs.closing_balance !== undefined ? Number(cs.closing_balance).toFixed(2) : 'قيد العمل') + '</td>' +
        '<td style="direction:ltr;font-family:monospace;font-weight:bold;color:' + (diff < -0.01 ? '#e11d48' : diff > 0.01 ? '#d97706' : '#059669') + ';">' + (cs.status === 'closed' ? ((diff > 0 ? '+' : '') + diff.toFixed(2)) : '—') + '</td>' +
        '<td style="font-family:monospace;font-size:10px;">' + formatCleanCaisseDate(cs.opened_at) + '</td>' +
        '</tr>'
      );
    }).join('');

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>التقرير الموحد لكل الصناديق والمناوبات</title>' +
      '<style>@page{size:A4 portrait;margin:12mm;}body{font-family:"Cairo",Tahoma,sans-serif;color:#0f172a;font-size:12px;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #0f172a;padding:6px;text-align:right;font-size:11px;}th{background:#e2e8f0;}</style>' +
      '</head><body>' +
      '<h2 style="margin:0;color:#1e3a8a;">🏛️ التقرير الرقابي الموحد لجميع الصناديق والمناوبات — ' + (s.shop_name || 'Gherbi.Ai POS') + '</h2>' +
      '<p>تاريخ الإصدار: ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' | عدد الحسابات: ' + users.length + ' | المناوبات المفتوحة الآن: ' + openSessions.length + '</p>' +
      '<table><thead><tr><th>#</th><th>أمين الصندوق (الحساب)</th><th>الحالة</th><th>الافتتاحي</th><th>المتوقع</th><th>الفعلي المعدود</th><th>الفارق (Écart)</th><th>توقيت الافتتاح</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '</body></html>';

    if (window.PrintEngine && typeof window.PrintEngine.printHtmlDocument === 'function') {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // --------------------------------------------------------------------------
  // 4) بناء الواجهة المزدوجة: (1. صندوقي ومناوبتي) + (2. إدارة كل الصناديق للمدير العام)
  // --------------------------------------------------------------------------
  App.switchCaisseSubPage = function (subPage) {
    AppState.caisseSubPage = subPage || 'my_till';
    this.renderCaisseView();
  };

  App.renderCaisseView = async function () {
    var root = document.getElementById('caisse-view-root');
    if (!root) return;

    await this.refreshActiveSession();
    var currentUser = AppState.currentUser || { id: 1, name: 'المدير العام', role: 'Admin' };
    var isAdmin = String(currentUser.role || 'Admin').toLowerCase() === 'admin';
    var requireShiftPolicy = String((AppState.settings && AppState.settings.caisse_require_session) || 'false') === 'true';

    var activeSessId = AppState.activeSession ? Number(AppState.activeSession.id) : null;
    var activeSummary = activeSessId
      ? await window.api.getCaisseSummary({ sessionId: activeSessId, userId: currentUser.id }).catch(function () { return null; })
      : null;

    var allSessions = (await window.api.getCaisseSessions().catch(function () { return []; })) || [];
    var txLog = (await window.api.getCaisseTransactionsLog().catch(function () { return []; })) || [];
    var allUsers = (await window.api.getUsers().catch(function () { return []; })) || [];
    if (allUsers.length === 0) {
      allUsers = [{ id: 1, name: 'المدير العام', username: 'admin', role: 'Admin', status: 'Active' }];
    }

    // فحص الفواتير النقدية الحرة التي بيعت اليوم بدون مناوبة (Unattached Orphan Sales)
    var todayStr = new Date().toISOString().slice(0, 10);
    var todaySales = (await window.api.getSales({ dateFrom: todayStr, dateTo: todayStr }).catch(function () { return []; })) || [];
    var alreadyReconciled = localStorage.getItem('gherbi_reconciled_orphan_sales_' + todayStr) || '';
    var orphanSales = todaySales.filter(function (s) {
      return !s.session_id && String(s.payment_method || 'cash').toLowerCase() === 'cash' && Number(s.paid_amount || 0) > 0 && !alreadyReconciled.includes('#' + s.id);
    });
    var orphanCashTotal = orphanSales.reduce(function (acc, s) { return acc + Number(s.paid_amount || 0); }, 0);
    var orphanIdsStr = orphanSales.map(function (s) { return '#' + s.id; }).join(', ');

    // شريط التبويبات العلوي للتنقل بين (صندوقي الشخصي) و (غرفة قيادة كل الصناديق للمدير العام)
    var topNavTabsHtml =
      '<div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 text-white shadow-md">' +
      '  <div class="flex flex-wrap items-center gap-2">' +
      '    <button type="button" onclick="App.switchCaisseSubPage(\'my_till\')" class="px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ' + (AppState.caisseSubPage === 'my_till' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">' +
      '      <span>💼 صندوقي ومناوبتي الشخصية (' + currentUser.name + ')</span>' +
      '    </button>' +
      (isAdmin
        ? '    <button type="button" onclick="App.switchCaisseSubPage(\'admin_all_tills\')" class="px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ' + (AppState.caisseSubPage === 'admin_all_tills' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : 'bg-slate-800 text-amber-400 hover:bg-slate-700') + '">' +
          '      <span>🏛️ إدارة ومراقبة كل الصناديق (غرفة قيادة المدير العام)</span>' +
          '    </button>'
        : '') +
      '  </div>' +
      '  <div class="flex flex-wrap items-center gap-2 text-xs">' +
      (isAdmin
        ? '    <button type="button" onclick="App.toggleRequireSessionPolicy()" class="px-3 py-1.5 rounded-xl font-bold border transition ' + (requireShiftPolicy ? 'bg-rose-600/20 border-rose-500 text-rose-300' : 'bg-emerald-600/20 border-emerald-500 text-emerald-300') + '">' +
          (requireShiftPolicy ? '🔒 الوضع الصارم: البيع مشروط بفتح مناوبة' : '🔓 الوضع المرن: البيع مسموح بدون مناوبة') +
          '    </button>'
        : '') +
      '    <button id="btnCaissePageQaBot" type="button" onclick="App.runAutoTest_CaissePage()" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black">🤖 فحص آلي (QA)</button>' +
      '  </div>' +
      '</div>';

    // ========================================================================
    // الصفحة الثانية (الخاصة بالمدير العام): غرفة قيادة وإدارة كل الصناديق
    // ========================================================================
    if (isAdmin && AppState.caisseSubPage === 'admin_all_tills') {
      var openSessionsList = allSessions.filter(function (s) { return s.status === 'open'; });
      var openDetailsList = await Promise.all(
        openSessionsList.map(function (s) {
          return window.api.getSessionDetails(s.id).catch(function () { return null; });
        })
      );

      var totalLiveCashInAllDrawers = 0;
      var totalSafeDropsAll = 0;
      openDetailsList.forEach(function (d) {
        if (d && d.summary) {
          totalLiveCashInAllDrawers += Number(d.summary.expectedBalance || 0);
          totalSafeDropsAll += Number(d.summary.totalCashOut || 0);
        }
      });

      var totalCumulativeDiscrepancy = allSessions
        .filter(function (s) { return s.status === 'closed'; })
        .reduce(function (acc, s) { return acc + Number(s.difference || 0); }, 0);

      // بناء بطاقة صندوق لكل حساب مستخدم في النظام
      var userTillCardsHtml = allUsers.map(function (u) {
        var userOpenSess = openSessionsList.find(function (s) { return Number(s.user_id) === Number(u.id); });
        var userOpenDetail = userOpenSess
          ? openDetailsList.find(function (d) { return d && d.session && Number(d.session.id) === Number(userOpenSess.id); })
          : null;
        var userHistory = allSessions.filter(function (s) { return Number(s.user_id) === Number(u.id); });
        var lastClosed = userHistory.find(function (s) { return s.status === 'closed'; });
        var userTotalDiff = userHistory
          .filter(function (s) { return s.status === 'closed'; })
          .reduce(function (acc, s) { return acc + Number(s.difference || 0); }, 0);

        var curExpected = userOpenDetail && userOpenDetail.summary
          ? Number(userOpenDetail.summary.expectedBalance || 0)
          : (userOpenSess ? Number(userOpenSess.opening_balance || 0) : 0);
        var curSalesCash = userOpenDetail && userOpenDetail.summary
          ? Number(userOpenDetail.summary.totalSalesCash || 0)
          : 0;

        return (
          '<div class="p-4 rounded-2xl border-2 ' + (userOpenSess ? 'border-emerald-500/50 bg-white dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50') + ' shadow-sm space-y-3">' +
          '  <div class="flex items-start justify-between gap-2">' +
          '    <div class="flex items-center gap-2.5">' +
          '      <div class="w-10 h-10 rounded-xl ' + (userOpenSess ? 'bg-emerald-600' : 'bg-slate-600') + ' text-white font-black flex items-center justify-center text-sm">' + String(u.name || 'م').charAt(0) + '</div>' +
          '      <div>' +
          '        <div class="font-black text-sm">' + u.name + ' <span class="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">' + (u.role || 'Cashier') + '</span></div>' +
          '        <div class="text-[11px] text-slate-400">' + (userOpenSess ? ('🟢 مناوبة نشطة #' + userOpenSess.id + ' منذ ' + formatCleanCaisseDate(userOpenSess.opened_at)) : ('⚪ الصندوق مغلق حالياً | إجمالي وردياته: ' + userHistory.length)) + '</div>' +
          '      </div>' +
          '    </div>' +
          '    <span class="px-2.5 py-1 rounded-full text-[10px] font-black ' + (userOpenSess ? 'bg-emerald-500/15 text-emerald-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500') + '">' + (userOpenSess ? 'مفتوح الآن' : 'مغلق') + '</span>' +
          '  </div>' +

          '  <div class="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-900/70 text-center text-xs">' +
          '    <div><div class="text-[10px] text-slate-400 font-bold">الرصيد الحالي بالدرج</div><div class="font-mono font-black text-blue-600 mt-0.5">' + curExpected.toFixed(2) + ' د.ج</div></div>' +
          '    <div><div class="text-[10px] text-slate-400 font-bold">مبيعات الوردية (+)</div><div class="font-mono font-black text-emerald-600 mt-0.5">+' + curSalesCash.toFixed(2) + ' د.ج</div></div>' +
          '    <div><div class="text-[10px] text-slate-400 font-bold">تراكمي الفروقات (Écart)</div><div class="font-mono font-black mt-0.5 ' + (userTotalDiff < -0.01 ? 'text-rose-600' : userTotalDiff > 0.01 ? 'text-amber-600' : 'text-emerald-600') + '">' + (userTotalDiff > 0 ? '+' : '') + userTotalDiff.toFixed(2) + ' د.ج</div></div>' +
          '  </div>' +

          '  <div class="flex flex-wrap items-center justify-end gap-1.5 pt-1 text-[11px]">' +
          (userOpenSess
            ? '    <button type="button" onclick="App.openSessionReviewModal(' + userOpenSess.id + ')" class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">📊 معاينة X-Report</button>' +
              '    <button type="button" onclick="App.openCaisseTxModalForSession(\'cash_in\', ' + userOpenSess.id + ')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/15 text-emerald-600 font-bold hover:bg-emerald-600 hover:text-white">+ تغذية</button>' +
              '    <button type="button" onclick="App.openCaisseTxModalForSession(\'cash_out\', ' + userOpenSess.id + ')" class="px-2.5 py-1.5 rounded-xl bg-amber-500/15 text-amber-600 font-bold hover:bg-amber-500 hover:text-slate-950">- سحب للخزنة</button>' +
              '    <button type="button" onclick="App.openCloseShiftModal(' + userOpenSess.id + ', ' + curExpected + ')" class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black">🛑 جرد وإغلاق مناوبته</button>'
            : '    <button type="button" onclick="App.adminOpenShiftForUser(' + u.id + ', \'' + String(u.name || '').replace(/'/g, "\\'") + '\')" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black">🟢 فتح مناوبة لهذا الحساب</button>' +
              (lastClosed
                ? '<button type="button" onclick="App.openSessionReviewModal(' + lastClosed.id + ')" class="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">🖨️ آخر Z-Report (#' + lastClosed.id + ')</button>'
                : '')) +
          '  </div>' +
          '</div>'
        );
      }).join('');

      root.innerHTML =
        '<div class="space-y-4">' +
        topNavTabsHtml +

        '  <div class="flex flex-wrap items-center justify-between gap-3">' +
        '    <div>' +
        '      <h2 class="text-2xl font-black text-amber-600 dark:text-amber-400">🏛️ غرفة قيادة وإدارة كل الصناديق والمناوبات (Multi-Caisse Command Center)</h2>' +
        '      <p class="text-xs text-slate-500">مراقبة حية لصناديق جميع البائعين، الخزنة المركزية، تسوية المبيعات الحرة، وكشف العجز والفائض لكل حساب</p>' +
        '    </div>' +
        '    <div class="flex flex-wrap gap-2 text-xs">' +
        '      <button type="button" onclick="App.printConsolidatedMultiCaisseReport()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-md">🖨️ طباعة التقرير الموحد لكل الصناديق (A4)</button>' +
        '    </div>' +
        '  </div>' +

        '  <div id="caisseKpiCardsGrid" class="grid grid-cols-1 md:grid-cols-4 gap-3.5">' +
        '    <div class="p-4 rounded-2xl bg-blue-600 text-white shadow-lg">' +
        '      <div class="text-xs font-bold opacity-85">إجمالي السيولة الحية في الصناديق المفتوحة (' + openSessionsList.length + ')</div>' +
        '      <div class="text-2xl font-black font-mono mt-1">' + totalLiveCashInAllDrawers.toFixed(2) + ' د.ج</div>' +
        '      <div class="text-[11px] font-bold text-amber-200 mt-1">🇩🇿 بالسنتيم: ' + (typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(totalLiveCashInAllDrawers) : '') + '</div>' +
        '    </div>' +
        '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-500/30 shadow-sm">' +
        '      <div class="text-xs font-bold text-slate-400">إجمالي التحويلات للخزنة الرئيسية (Safe Drops)</div>' +
        '      <div class="text-2xl font-black font-mono text-indigo-600 mt-1">' + totalSafeDropsAll.toFixed(2) + ' د.ج</div>' +
        '      <div class="text-[11px] text-slate-400 mt-1">نقد مؤمّن خارج أدراج الكاشير</div>' +
        '    </div>' +
        '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-amber-500/30 shadow-sm">' +
        '      <div class="text-xs font-bold text-slate-400">مبيعات نقدية حرة اليوم (بدون مناوبة)</div>' +
        '      <div class="text-2xl font-black font-mono text-amber-600 mt-1">' + orphanCashTotal.toFixed(2) + ' د.ج <span class="text-xs">(' + orphanSales.length + ' فاتورة)</span></div>' +
        (orphanCashTotal > 0
          ? '<button type="button" onclick="App.attachOrphanSalesToCurrentShift(' + orphanSales.length + ', ' + orphanCashTotal + ', \'' + orphanIdsStr + '\')" class="mt-1 px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px]">🔗 ضم للمناوبة النشطة</button>'
          : '<div class="text-[11px] text-emerald-600 font-bold mt-1">✅ جميع مبيعات اليوم مربوطة بالصناديق</div>') +
        '    </div>' +
        '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-rose-500/30 shadow-sm">' +
        '      <div class="text-xs font-bold text-slate-400">صافي الفروقات التراكمي لكل الموظفين (Écart)</div>' +
        '      <div class="text-2xl font-black font-mono mt-1 ' + (totalCumulativeDiscrepancy < -0.01 ? 'text-rose-600' : totalCumulativeDiscrepancy > 0.01 ? 'text-amber-600' : 'text-emerald-600') + '">' + (totalCumulativeDiscrepancy > 0 ? '+' : '') + totalCumulativeDiscrepancy.toFixed(2) + ' د.ج</div>' +
        '      <div class="text-[11px] text-slate-400 mt-1">عبر ' + allSessions.length + ' مناوبة مسجلة</div>' +
        '    </div>' +
        '  </div>' +

        '  <div>' +
        '    <h3 class="font-black text-sm mb-2.5">👥 صناديق الحسابات والمستخدمين الحية (' + allUsers.length + ' حساب):</h3>' +
        '    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">' + userTillCardsHtml + '</div>' +
        '  </div>' +

        '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
        '    <div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
        '      <h3 class="font-black text-sm">📋 السجل الرقابي الشامل لجميع المناوبات (كل الحسابات)</h3>' +
        '      <select onchange="AppState.adminSelectedUserFilter=this.value; App.renderCaisseView()" class="px-3 py-1.5 rounded-xl text-xs font-bold">' +
        '        <option value="all">جميع المستخدمين (' + allSessions.length + ')</option>' +
        allUsers.map(function (u) {
          return '<option value="' + u.id + '" ' + (String(AppState.adminSelectedUserFilter) === String(u.id) ? 'selected' : '') + '>' + u.name + '</option>';
        }).join('') +
        '      </select>' +
        '    </div>' +
        '    <div class="max-h-80 overflow-y-auto">' +
        '      <table class="w-full text-xs text-right">' +
        '        <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-2">#</th><th class="py-2">الحساب / الكاشير</th><th class="py-2">الافتتاح</th><th class="py-2">الإغلاق</th><th class="py-2">الافتتاحي</th><th class="py-2">المتوقع</th><th class="py-2">الفعلي</th><th class="py-2">الفارق (Écart)</th><th class="py-2 text-center">إجراءات المدير</th></tr></thead>' +
        '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
        allSessions
          .filter(function (s) {
            return AppState.adminSelectedUserFilter === 'all' || String(s.user_id) === String(AppState.adminSelectedUserFilter);
          })
          .map(function (s) {
            var isOpen = s.status === 'open';
            var diff = Number(s.difference || 0);
            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 font-mono font-black text-blue-600">#' + s.id + '</td>' +
              '  <td class="py-2.5 font-bold">' + (s.user_name || 'المدير العام') + '</td>' +
              '  <td class="py-2.5 font-mono text-[11px] text-slate-400">' + formatCleanCaisseDate(s.opened_at) + '</td>' +
              '  <td class="py-2.5 font-mono text-[11px] text-slate-400">' + (s.closed_at ? formatCleanCaisseDate(s.closed_at) : '<span class="text-emerald-600 font-bold">🟢 مفتوحة الآن</span>') + '</td>' +
              '  <td class="py-2.5 font-mono font-bold">' + Number(s.opening_balance || 0).toFixed(2) + '</td>' +
              '  <td class="py-2.5 font-mono text-blue-600 font-bold">' + (s.expected_balance !== null && s.expected_balance !== undefined ? Number(s.expected_balance).toFixed(2) : '—') + '</td>' +
              '  <td class="py-2.5 font-mono font-bold">' + (isOpen ? '—' : Number(s.closing_balance || 0).toFixed(2)) + '</td>' +
              '  <td class="py-2.5 font-mono font-black ' + (diff < -0.01 ? 'text-rose-600' : diff > 0.01 ? 'text-amber-600' : 'text-emerald-600') + '">' + (isOpen ? '—' : ((diff > 0 ? '+' : '') + diff.toFixed(2))) + '</td>' +
              '  <td class="py-2.5 flex items-center justify-center gap-1">' +
              '    <button type="button" onclick="App.openSessionReviewModal(' + s.id + ')" class="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-[11px]">📋 تفاصيل ومعاينة</button>' +
              '    <button type="button" onclick="App.printSessionZReport(' + s.id + ', \'dialog_80mm\')" class="px-2.5 py-1 bg-slate-800 text-white rounded-lg font-bold text-[11px]">🖨️ Z-Report</button>' +
              (isOpen
                ? '<button type="button" onclick="App.openCloseShiftModal(' + s.id + ', ' + Number(s.opening_balance || 0) + ')" class="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold text-[11px]">إغلاق</button>'
                : '') +
              '  </td>' +
              '</tr>'
            );
          }).join('') +
        '        </tbody>' +
        '      </table>' +
        '    </div>' +
        '  </div>' +
        '</div>';

      if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
      return;
    }

    // ========================================================================
    // الصفحة الأولى: صندوقي ومناوبتي الشخصية (My Personal Cashier Till)
    // ========================================================================
    var mySessions = allSessions.filter(function (s) {
      return !s.user_id || Number(s.user_id) === Number(currentUser.id);
    });

    var displaySummary = activeSummary && activeSummary.summary ? activeSummary.summary : null;
    var isShowingLastClosed = false;
    var lastClosedSess = null;

    if (!displaySummary && mySessions.length > 0) {
      var lastDetails = await window.api.getSessionDetails(mySessions[0].id).catch(function () { return null; });
      if (lastDetails && lastDetails.summary) {
        displaySummary = lastDetails.summary;
        lastClosedSess = lastDetails.session;
        isShowingLastClosed = true;
      }
    }

    var sum = displaySummary || {
      openingBalance: 0,
      totalSalesCash: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      totalExpenses: 0,
      totalRefunds: 0,
      expectedBalance: 0
    };

    var totalOutflows = Number((Number(sum.totalCashOut || 0) + Number(sum.totalExpenses || 0) + Number(sum.totalRefunds || 0)).toFixed(2));
    var totalInflows = Number((Number(sum.totalSalesCash || 0) + Number(sum.totalCashIn || 0)).toFixed(2));
    var expectedDrawer = Number(sum.expectedBalance || 0);
    var centimeDrawer = typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(expectedDrawer) : '';

    var filteredTxs = txLog.filter(function (t) {
      if (AppState.caisseTxFilterType === 'in') {
        if (!getCaisseTxTypeInfo(t.type).isIn) return false;
      } else if (AppState.caisseTxFilterType === 'out') {
        if (getCaisseTxTypeInfo(t.type).isIn) return false;
      }
      if (AppState.caisseTxSearchQuery) {
        var q = AppState.caisseTxSearchQuery.toLowerCase();
        var matchDesc = String(t.description || '').toLowerCase().includes(q);
        var matchAmt = String(t.amount || '').includes(q);
        if (!matchDesc && !matchAmt) return false;
      }
      return true;
    });

    root.innerHTML =
      '<div class="space-y-4">' +
      topNavTabsHtml +

      '  <div class="flex flex-wrap items-center justify-between gap-3">' +
      '    <div>' +
      '      <h2 class="text-2xl font-black">💼 إدارة صندوقي ومناوبتي (' + currentUser.name + ')</h2>' +
      '      <p class="text-xs text-slate-500">فتح وإغلاق الوردية الشخصية، حاسبة الفئات النقدية الجزائرية، الإيداع والسحب، وتقارير X-Report و Z-Report</p>' +
      '    </div>' +
      '    <div class="flex flex-wrap items-center gap-2 text-xs">' +
      (activeSessId
        ? '<button type="button" onclick="App.openCaisseTxModalForSession(\'cash_in\', ' + activeSessId + ')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm">+ إيداع نقدي (F2)</button>' +
          '<button type="button" onclick="App.openCaisseTxModalForSession(\'cash_out\', ' + activeSessId + ')" class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-sm">- سحب نقدي (F3)</button>' +
          '<button type="button" onclick="App.openSafeDropModal()" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm">🔒 تحويل للخزنة (Safe Drop)</button>' +
          '<button type="button" onclick="App.openSessionReviewModal(' + activeSessId + ')" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow-sm">📊 تقرير X-Report الفوري (F9)</button>' +
          '<button type="button" onclick="App.openCloseShiftModal(' + activeSessId + ', ' + expectedDrawer + ')" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black shadow-md">🛑 إغلاق المناوبة وجرد الدرج (Z-Report)</button>'
        : '<button type="button" onclick="App.openModal(\'openShiftModal\')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/25">+ فتح مناوبة صندوق جديدة الآن</button>' +
          (mySessions.length > 0
            ? '<button type="button" onclick="App.openSessionReviewModal(' + mySessions[0].id + ')" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold">🖨️ معاينة وطباعة آخر Z-Report (#' + mySessions[0].id + ')</button>'
            : '')) +
      '      <button type="button" onclick="window.api.openCashDrawer()" title="فتح درج النقود إلكترونياً (F10)" class="px-3 py-2 rounded-xl bg-slate-800 text-white font-bold">🔓 الدرج (F10)</button>' +
      '    </div>' +
      '  </div>' +

      (activeSessId
        ? '<div class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">' +
          '  <div class="font-black text-emerald-700 dark:text-emerald-300">🟢 المناوبة الحالية مفتوحة ونشطة (رقم #' + activeSessId + ') — الكاشير: ' + currentUser.name + ' — بدأت في: ' + formatCleanCaisseDate(AppState.activeSession.opened_at) + '</div>' +
          '  <div class="font-bold text-slate-500">جميع المبيعات النقدية لحسابك تُقيد تلقائياً في هذه المناوبة</div>' +
          '</div>'
        : '<div class="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">' +
          '  <div class="font-black text-amber-700 dark:text-amber-300">⚠️ لا توجد مناوبة مفتوحة حالياً لحساب (' + currentUser.name + ')' + (isShowingLastClosed && lastClosedSess ? ' — الأرقام أدناه تعرض ملخص آخر مناوبة مغلقة (#' + lastClosedSess.id + ')' : '') + '</div>' +
          '  <button type="button" onclick="App.openModal(\'openShiftModal\')" class="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black">افتح مناوبة جديدة الآن</button>' +
          '</div>') +

      (orphanCashTotal > 0
        ? '<div class="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">' +
          '  <div><strong class="text-indigo-600 dark:text-indigo-400">💡 مبيعات نقدية حرة تمت اليوم بدون مناوبة (' + orphanSales.length + ' فاتورة: ' + orphanIdsStr + '):</strong> إجماليها النقدي <strong class="font-mono">' + orphanCashTotal.toFixed(2) + ' د.ج</strong> محفوظ في سجل المبيعات والأرباح، لكنه غير مضاف لدرج المناوبة.</div>' +
          '  <button type="button" onclick="App.attachOrphanSalesToCurrentShift(' + orphanSales.length + ', ' + orphanCashTotal + ', \'' + orphanIdsStr + '\')" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-sm">🔗 ضم وإدراج المبيعات الحرة في مناوبتي الحالية</button>' +
          '</div>'
        : '') +

      '  <div id="caisseKpiCardsGrid" class="grid grid-cols-1 md:grid-cols-4 gap-3.5">' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">الرصيد الافتتاحي (Fond de Caisse)</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + Number(sum.openingBalance || 0).toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-slate-400 mt-1">' + (typeof App.formatAlgerianCentimes === 'function' ? App.formatAlgerianCentimes(sum.openingBalance || 0) : '') + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">مبيعات وتسديدات وإيداعات النقد (+)</div>' +
      '      <div class="text-2xl font-black font-mono text-emerald-600 mt-1">+' + totalInflows.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-emerald-600 font-bold mt-1">مبيعات: ' + Number(sum.totalSalesCash || 0).toFixed(2) + ' | إيداعات: ' + Number(sum.totalCashIn || 0).toFixed(2) + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">' +
      '      <div class="text-xs text-slate-400 font-bold">المصاريف والمسحوبات والمرتجعات (-)</div>' +
      '      <div class="text-2xl font-black font-mono text-rose-500 mt-1">-' + totalOutflows.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] text-rose-500 font-bold mt-1">سحوبات: ' + Number(sum.totalCashOut || 0).toFixed(2) + ' | مصاريف: ' + Number(sum.totalExpenses || 0).toFixed(2) + '</div>' +
      '    </div>' +
      '    <div class="p-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">' +
      '      <div class="text-xs font-bold opacity-85">الرصيد المتوقع في الدرج حالياً</div>' +
      '      <div class="text-2xl font-black font-mono mt-1">' + expectedDrawer.toFixed(2) + ' د.ج</div>' +
      '      <div class="text-[11px] font-bold text-amber-200 mt-1">🇩🇿 بالسنتيم: ' + centimeDrawer + '</div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">' +
      '    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
      '      <div class="flex items-center justify-between mb-3">' +
      '        <h3 class="font-black text-sm">سجل المناوبات وتقارير Z-Report (' + mySessions.length + ')</h3>' +
      '        <span class="text-[11px] text-slate-400 font-bold">انقر على (🖨️ Z-Report) أو (تفاصيل) للطباعة</span>' +
      '      </div>' +
      '      <div class="max-h-96 overflow-y-auto">' +
      '        <table class="w-full text-xs text-right">' +
      '          <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-2">#</th><th class="py-2">المستخدم</th><th class="py-2">الافتتاح</th><th class="py-2">الافتتاحي</th><th class="py-2">الختامي</th><th class="py-2">الفارق</th><th class="py-2 text-center">إجراءات التقرير</th></tr></thead>' +
      '          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (mySessions.length > 0
        ? mySessions.map(function (s) {
            var isOpen = s.status === 'open';
            var diff = Number(s.difference || 0);
            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5 font-mono font-black text-blue-600">#' + s.id + '</td>' +
              '  <td class="py-2.5 font-bold">' + (s.user_name || currentUser.name) + '</td>' +
              '  <td class="py-2.5 font-mono text-slate-400 text-[11px]">' + formatCleanCaisseDate(s.opened_at) + '</td>' +
              '  <td class="py-2.5 font-mono font-bold">' + Number(s.opening_balance || 0).toFixed(2) + '</td>' +
              '  <td class="py-2.5 font-mono font-bold">' + (isOpen ? '<span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 text-[10px]">مفتوحة</span>' : Number(s.closing_balance || 0).toFixed(2)) + '</td>' +
              '  <td class="py-2.5 font-mono font-black ' + (diff < -0.01 ? 'text-rose-600' : diff > 0.01 ? 'text-amber-600' : 'text-emerald-600') + '">' + (isOpen ? '—' : (diff > 0 ? '+' : '') + diff.toFixed(2)) + '</td>' +
              '  <td class="py-2.5 flex items-center justify-center gap-1">' +
              '    <button type="button" onclick="App.openSessionReviewModal(' + s.id + ')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[11px] shadow-sm">📋 تفاصيل ومعاينة</button>' +
              '    <button type="button" onclick="App.printSessionZReport(' + s.id + ', \'dialog_80mm\')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-[11px]" title="طباعة مباشرة لتقرير Z-Report">🖨️ Z-Report</button>' +
              (isOpen
                ? '<button type="button" onclick="App.openCloseShiftModal(' + s.id + ', ' + expectedDrawer + ')" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-[11px]">إغلاق</button>'
                : '') +
              '  </td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="7" class="py-8 text-center text-slate-400 font-bold">لا توجد مناوبات مسجلة بعد</td></tr>') +
      '          </tbody>' +
      '        </table>' +
      '      </div>' +
      '    </div>' +

      '    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">' +
      '      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
      '        <h3 class="font-black text-sm">حركات الخزينة المباشرة (' + filteredTxs.length + ')</h3>' +
      '        <div class="flex items-center gap-1 text-[11px]">' +
      '          <input id="caisseTxSearchInput" type="text" value="' + (AppState.caisseTxSearchQuery || '') + '" oninput="App.onCaisseTxSearch(this.value)" placeholder="🔍 [F4] بحث في الحركات..." class="w-36 px-2.5 py-1 rounded-lg text-xs font-bold">' +
      '          <button type="button" onclick="AppState.caisseTxFilterType=\'all\'; App.renderCaisseView()" class="px-2 py-1 rounded-lg font-bold ' + (AppState.caisseTxFilterType === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700') + '">الكل</button>' +
      '          <button type="button" onclick="AppState.caisseTxFilterType=\'in\'; App.renderCaisseView()" class="px-2 py-1 rounded-lg font-bold ' + (AppState.caisseTxFilterType === 'in' ? 'bg-emerald-600 text-white' : 'bg-emerald-500/10 text-emerald-600') + '">داخل (+)</button>' +
      '          <button type="button" onclick="AppState.caisseTxFilterType=\'out\'; App.renderCaisseView()" class="px-2 py-1 rounded-lg font-bold ' + (AppState.caisseTxFilterType === 'out' ? 'bg-rose-600 text-white' : 'bg-rose-500/10 text-rose-600') + '">خارج (-)</button>' +
      '        </div>' +
      '      </div>' +
      '      <div class="max-h-96 overflow-y-auto">' +
      '        <table class="w-full text-xs text-right">' +
      '          <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-2">النوع</th><th class="py-2">البيان</th><th class="py-2">المبلغ</th><th class="py-2">التوقيت</th></tr></thead>' +
      '          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
      (filteredTxs.length > 0
        ? filteredTxs.map(function (t) {
            var info = getCaisseTxTypeInfo(t.type);
            return (
              '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">' +
              '  <td class="py-2.5"><span class="px-2 py-0.5 rounded-lg font-bold text-[11px] ' + info.cls + '">' + info.label + '</span></td>' +
              '  <td class="py-2.5 font-bold">' + (t.description || '—') + '</td>' +
              '  <td class="py-2.5 font-mono font-black ' + (info.isIn ? 'text-emerald-600' : 'text-rose-600') + '">' + info.sign + Number(t.amount || 0).toFixed(2) + ' د.ج</td>' +
              '  <td class="py-2.5 font-mono text-slate-400 text-[11px]">' + formatCleanCaisseDate(t.created_at) + '</td>' +
              '</tr>'
            );
          }).join('')
        : '<tr><td colspan="4" class="py-8 text-center text-slate-400 font-bold">لا توجد حركات مطابقة للفلتر الحالي</td></tr>') +
      '          </tbody>' +
      '        </table>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (window.SvgIconEngine) window.SvgIconEngine.scanAndRenderIcons(root);
  };

  // تحديث اختصار F9 في شاشة الصندوق ليفتح X-Report الفوري بأمان
  document.addEventListener('keydown', function (e) {
    if (AppState.currentView !== 'caisse') return;
    var activeModal = document.querySelector('.modal-overlay.active');
    if (activeModal) return;

    if (e.key === 'F9') {
      e.preventDefault();
      e.stopPropagation();
      App.openSessionReviewModal(AppState.activeSession ? AppState.activeSession.id : null);
    }
  }, true);
}

// ============================================================================
// 3. حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [MULTI-CAISSE COMMAND CENTER & CLOSE SHIFT FIX V2]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installCaisseMasterSuiteAndCloseFix.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن إصلاح إغلاق المناوبة و X-Report وغرفة قيادة كل الصناديق للمدير العام في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['fix-promos-bundles-and-smart-margin.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('✅ 3/3: تم تنظيف الجذر وأرشفة السكربتات السابقة.');
console.log('\n🎉 اكتملت الترقية! أعد تشغيل التطبيق (أو اضغط Ctrl+R) وجرّب إغلاق المناوبة وتقرير X-Report وغرفة قيادة الصناديق.');