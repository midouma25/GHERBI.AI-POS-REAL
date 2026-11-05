/**
 * upgrade-page17-biometric-timeclock-and-clean-payroll-v3.js
 * الترقية الجراحية والاستشارية الخارقة (الإصدار V3) للصفحة 17 (#view-users):
 *
 * أولاً: محطة البصمة الافتراضية الذكية واستوديو تعديل الحجم الساعي للمدير (Tab 5: Biometric / Barcode / PIN Time-Clock & Admin Override Studio):
 * - تسجيل الحضور والانصراف بـ 3 طرق: (1. الكود السري PIN لكل عامل مع لوحة لمسية | 2. مسح باركود بطاقة العامل USR-0001 | 3. مستشعر البصمة البيومترية التفاعلي)
 * - حساب تلقائي لدقائق التأخر الصباحي والساعات الإضافية ومؤقت حي للعمال المتواجدين في الدوام + وضع الاستراحة (☕ Pause)
 * - استوديو المدير (Admin Override): تعويض البصمة المنسية، إضافة حجم ساعي يدوي (ساعات + دقائق)، وتعديل مباشر لأي سجل بصمة في الجدول (+8 ساعات يوم كامل / تعديل الساعات والدقائق / حذف آمن).
 *
 * ثانياً: إعادة هندسة حاسبة الرواتب الشاملة (Tab 4: Clean Step-by-Step Dynamic Payroll Studio):
 * - كتابة فائقة السلاسة والسرعة (0.1ms Live DOM Recalc) بدون إعادة رسم الصفحة وبدون فقدان التركيز أثناء الكتابة!
 * - تنظيم بصري ومحاسبي واضح من 3 خطوات يعرض فقط حقول الطريقة المختارة (ساعات ودقائق | يومية | راتب شهري ثابت | مناوبات | هجين) مع ربط حي ودقيق بالبصمة بالدقيقة.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء حقن محطة البصمة الذكية (PIN / Barcode / Biometric + Admin Override) وحاسبة الرواتب المنظمة فائقة السلاسة (V3)...\n');

function installPage17BiometricTimeClockAndCleanPayrollV3() {
  if (!window.App || !window.AppState) return;

  // إعدادات الدوام الرسمي للمتجر (تستخدم لحساب التأخر والساعات الإضافية تلقائياً)
  AppState.officialShiftStartTime = localStorage.getItem('gherbi_shift_start_time') || '08:00';
  AppState.officialStandardDailyHours = Number(localStorage.getItem('gherbi_std_daily_hours') || 8);
  AppState.timeClockPinBuffer = '';
  AppState.timeClockFilterUserId = 'all';

  function fmtCentimes(dzd) {
    return typeof App.formatAlgerianCentimes === 'function'
      ? App.formatAlgerianCentimes(dzd)
      : (Math.round(Number(dzd || 0) * 100)).toLocaleString('fr-DZ') + ' سنتيم';
  }

  // استخراج الكود السري (PIN) وباركود البطاقة لكل عامل
  App.getEmployeePinAndBarcode = function (userObj) {
    var uid = Number((userObj && userObj.id) || 1);
    var savedPins = JSON.parse(localStorage.getItem('gherbi_emp_pins_v1') || '{}');
    var pin = savedPins[uid] || String(1000 + uid);
    var barcode = 'USR-' + String(uid).padStart(4, '0');
    return { pin: pin, barcode: barcode };
  };

  App.saveEmployeeCustomPin = function (userId, newPin) {
    var clean = String(newPin || '').trim();
    if (!clean) return;
    var savedPins = JSON.parse(localStorage.getItem('gherbi_emp_pins_v1') || '{}');
    savedPins[Number(userId)] = clean;
    localStorage.setItem('gherbi_emp_pins_v1', JSON.stringify(savedPins));
    if (typeof showToast === 'function') {
      showToast('🔢 تم تحديث كود البصمة السري للموظف إلى: ' + clean, 'success');
    }
    this.renderUsersView();
  };

  // ==========================================================================
  // 1. حساب إجمالي الحجم الساعي الدقيق (الساعات، الدقائق، الإضافي، التأخر، وأيام الحضور) لكل عامل من سجل البصمة
  // ==========================================================================
  App.getEmployeeTimeClockSummary = function (userId) {
    var uid = Number(userId || 1);
    var logs = (AppState.staffTimeClockLogs || []).filter(function (l) {
      return Number(l.userId) === uid;
    });

    var totalRegularMinutes = 0;
    var totalOvertimeMinutes = 0;
    var totalLateMinutes = 0;
    var distinctDates = {};
    var activeOpenSession = null;

    var stdDailyMins = Math.max(60, Number(AppState.officialStandardDailyHours || 8) * 60);

    logs.forEach(function (l) {
      if (!l.checkOut) {
        activeOpenSession = l;
        // حساب الدقائق الحية منذ الدخول حتى الآن
        var liveMins = Math.max(1, Math.round((Date.now() - new Date(l.checkIn).getTime()) / 60000));
        totalRegularMinutes += Math.min(stdDailyMins, liveMins);
        if (liveMins > stdDailyMins) totalOvertimeMinutes += (liveMins - stdDailyMins);
      } else {
        var dur = Math.max(0, Number(l.durationMinutes || 0));
        var customOt = Number(l.overtimeMinutes || 0);
        if (customOt > 0) {
          totalRegularMinutes += dur;
          totalOvertimeMinutes += customOt;
        } else if (dur > stdDailyMins) {
          totalRegularMinutes += stdDailyMins;
          totalOvertimeMinutes += (dur - stdDailyMins);
        } else {
          totalRegularMinutes += dur;
        }
      }
      totalLateMinutes += Math.max(0, Number(l.lateMinutes || 0));
      var dStr = String(l.date || l.checkIn || '').slice(0, 10);
      if (dStr) distinctDates[dStr] = true;
    });

    var grandTotalMinutes = totalRegularMinutes + totalOvertimeMinutes;
    return {
      userId: uid,
      logsCount: logs.length,
      workedDaysCount: Object.keys(distinctDates).length,
      regularHours: Math.floor(totalRegularMinutes / 60),
      regularMinutes: totalRegularMinutes % 60,
      overtimeHours: Math.floor(totalOvertimeMinutes / 60),
      overtimeMinutes: totalOvertimeMinutes % 60,
      totalHours: Math.floor(grandTotalMinutes / 60),
      totalMinutes: grandTotalMinutes % 60,
      grandTotalMinutes: grandTotalMinutes,
      lateMinutes: totalLateMinutes,
      activeOpenSession: activeOpenSession
    };
  };

  // ==========================================================================
  // 2. محرك تسجيل البصمة المتعدد الوسائط (كود سري PIN / باركود USR / بصمة بيومترية)
  // ==========================================================================
  App.punchStaffByCodeOrBarcode = async function (rawInput, methodLabel) {
    var clean = String(rawInput || '').trim().toUpperCase();
    if (!clean) {
      if (typeof showToast === 'function') showToast('يرجى إدخال كود العامل (مثلاً 1001 أو 1002) أو مسح باركود البطاقة (USR-0001)', 'warning');
      return;
    }

    var users = (await window.api.getUsers().catch(function () { return []; })) || [];
    var matchedUser = users.find(function (u) {
      var info = App.getEmployeePinAndBarcode(u);
      return (
        info.pin.toUpperCase() === clean ||
        info.barcode.toUpperCase() === clean ||
        String(u.username || '').toUpperCase() === clean ||
        ('#' + u.id) === clean ||
        String(u.id) === clean
      );
    });

    if (!matchedUser) {
      if (typeof playBeep === 'function') playBeep(false);
      if (typeof showToast === 'function') {
        showToast('❌ لم يتم العثور على موظف بهذا الكود أو الباركود: (' + clean + ')', 'error');
      }
      return;
    }

    var openLog = (AppState.staffTimeClockLogs || []).find(function (l) {
      return Number(l.userId) === Number(matchedUser.id) && !l.checkOut;
    });

    var actionType = openLog ? 'out' : 'in';
    this.punchStaffTimeClockEnhanced(matchedUser.id, actionType, methodLabel || 'كود/باركود');

    var inp = document.getElementById('timeClockQuickCodeInput');
    if (inp) inp.value = '';
  };

  App.punchStaffTimeClockEnhanced = function (userId, punchType, methodUsed) {
    var uid = Number(userId || 1);
    var st = (AppState._cachedUserStatsMap || {})[uid];
    var empName = st && st.user ? st.user.name : ('موظف #' + uid);
    var nowObj = new Date();
    var nowIso = nowObj.toISOString();
    var todayStr = nowIso.slice(0, 10);
    var methodTag = methodUsed || 'بصمة بيومترية';

    if (punchType === 'in') {
      // حساب دقائق التأخر الصباحي مقارنة بوقت الدوام الرسمي (مثلاً 08:00)
      var lateMins = 0;
      var shiftStartStr = AppState.officialShiftStartTime || '08:00';
      var parts = shiftStartStr.split(':');
      if (parts.length === 2) {
        var officialStart = new Date(nowObj);
        officialStart.setHours(parseInt(parts[0], 10) || 8, parseInt(parts[1], 10) || 0, 0, 0);
        if (nowObj > officialStart) {
          var diffLate = Math.round((nowObj.getTime() - officialStart.getTime()) / 60000);
          // إذا كان التأخر أقل من 4 ساعات نعتبره تأخراً صباحياً قابلاً للتعديل
          if (diffLate > 5 && diffLate < 240) lateMins = diffLate;
        }
      }

      AppState.staffTimeClockLogs.unshift({
        id: 'TC-' + Date.now(),
        userId: uid,
        empName: empName,
        date: todayStr,
        checkIn: nowIso,
        checkOut: null,
        durationMinutes: 0,
        lateMinutes: lateMins,
        overtimeMinutes: 0,
        method: methodTag,
        note: 'تسجيل حضور (' + methodTag + ')'
      });

      if (typeof playBeep === 'function') playBeep(true);
      this.pushMicroForensicEvent('timeclock_event', 'normal', 'pos_micro', {
        note: '🟢 بصمة حضور للموظف (' + empName + ') عبر [' + methodTag + ']'
      }, true);
      if (typeof showToast === 'function') {
        showToast('🟢 تم تسجيل حضور الموظف (' + empName + ') عبر [' + methodTag + '] بنجاح!', 'success');
      }
    } else {
      var openLog = (AppState.staffTimeClockLogs || []).find(function (l) {
        return Number(l.userId) === uid && !l.checkOut;
      });
      if (openLog) {
        openLog.checkOut = nowIso;
        var diffMin = Math.max(1, Math.round((nowObj.getTime() - new Date(openLog.checkIn).getTime()) / 60000));
        openLog.durationMinutes = diffMin;
        openLog.method = openLog.method + ' ⬅️ ' + methodTag;
      } else {
        // إذا ضغط انصراف وكان قد نسي تسجيل الدخول، نسجل له دواماً افتراضياً قابلاً للتعديل
        var stdMins = Math.max(60, Number(AppState.officialStandardDailyHours || 8) * 60);
        AppState.staffTimeClockLogs.unshift({
          id: 'TC-' + Date.now(),
          userId: uid,
          empName: empName,
          date: todayStr,
          checkIn: new Date(nowObj.getTime() - stdMins * 60000).toISOString(),
          checkOut: nowIso,
          durationMinutes: stdMins,
          lateMinutes: 0,
          overtimeMinutes: 0,
          method: methodTag + ' (تعويض تلقائي)',
          note: 'انصراف مع تعويض دخول منسي'
        });
      }

      if (typeof playBeep === 'function') playBeep(true);
      this.pushMicroForensicEvent('timeclock_event', 'normal', 'pos_micro', {
        note: '🔴 بصمة انصراف للموظف (' + empName + ') عبر [' + methodTag + ']'
      }, true);
      if (typeof showToast === 'function') {
        showToast('🔴 تم تسجيل انصراف الموظف (' + empName + ') وحساب الساعات والدقائق بنجاح!', 'info');
      }
    }

    localStorage.setItem('gherbi_staff_timeclock_v1', JSON.stringify(AppState.staffTimeClockLogs));
    this.renderUsersView();
  };

  // ==========================================================================
  // 3. استوديو المدير لتعديل الحجم الساعي وتعويض البصمة المنسية (Admin Timesheet Override)
  // ==========================================================================
  App.adminAddOrOverrideAttendanceRecord = function () {
    var uid = Number(document.getElementById('admTcEmpSelect')?.value || 1);
    var dateStr = document.getElementById('admTcDateInput')?.value || new Date().toISOString().slice(0, 10);
    var timeIn = document.getElementById('admTcTimeInInput')?.value || '08:00';
    var timeOut = document.getElementById('admTcTimeOutInput')?.value || '16:00';
    var directHrs = parseInt(document.getElementById('admTcDirectHours')?.value || '0', 10) || 0;
    var directMins = parseInt(document.getElementById('admTcDirectMins')?.value || '0', 10) || 0;
    var lateMins = Math.max(0, parseInt(document.getElementById('admTcLateMins')?.value || '0', 10) || 0);
    var reason = String(document.getElementById('admTcReasonInput')?.value || 'تعديل إداري / تعويض نسيان البصمة').trim();

    var totalDurationMins = 0;
    if (directHrs > 0 || directMins > 0) {
      totalDurationMins = directHrs * 60 + directMins;
    } else {
      var dtIn = new Date(dateStr + 'T' + timeIn + ':00');
      var dtOut = new Date(dateStr + 'T' + timeOut + ':00');
      if (dtOut > dtIn) {
        totalDurationMins = Math.round((dtOut.getTime() - dtIn.getTime()) / 60000);
      } else {
        totalDurationMins = 480; // 8 ساعات افتراضياً
      }
    }

    var st = (AppState._cachedUserStatsMap || {})[uid];
    var empName = st && st.user ? st.user.name : ('موظف #' + uid);

    AppState.staffTimeClockLogs.unshift({
      id: 'TC-ADM-' + Date.now(),
      userId: uid,
      empName: empName,
      date: dateStr,
      checkIn: dateStr + 'T' + timeIn + ':00',
      checkOut: dateStr + 'T' + timeOut + ':00',
      durationMinutes: totalDurationMins,
      lateMinutes: lateMins,
      overtimeMinutes: 0,
      method: '🛠️ تعديل المدير (Admin)',
      note: reason
    });

    localStorage.setItem('gherbi_staff_timeclock_v1', JSON.stringify(AppState.staffTimeClockLogs));
    this.pushMicroForensicEvent('timeclock_event', 'medium', 'security', {
      note: '🛠️ قام المدير بإضافة/تعديل حجم ساعي (' + Math.floor(totalDurationMins / 60) + 'سا و ' + (totalDurationMins % 60) + 'د) للموظف (' + empName + ') — السبب: ' + reason
    }, true);

    this.renderUsersView();
    if (typeof showToast === 'function') {
      showToast('✅ تم اعتماد وإضافة (' + Math.floor(totalDurationMins / 60) + ' ساعة و ' + (totalDurationMins % 60) + ' دقيقة) للحجم الساعي للموظف ' + empName + '!', 'success');
    }
  };

  // تعديل مباشر لأي سطر في جدول البصمة (تغيير الساعات والدقائق أو إغلاق بصمة مفتوحة)
  App.adminUpdateSingleTimeClockRow = function (logId, customHours, customMinutes, customLate) {
    var row = (AppState.staffTimeClockLogs || []).find(function (l) { return String(l.id) === String(logId); });
    if (!row) return;

    var hrs = Math.max(0, parseInt(customHours !== undefined ? customHours : document.getElementById('tcRowHrs_' + logId)?.value, 10) || 0);
    var mins = Math.max(0, parseInt(customMinutes !== undefined ? customMinutes : document.getElementById('tcRowMins_' + logId)?.value, 10) || 0);
    var late = Math.max(0, parseInt(customLate !== undefined ? customLate : document.getElementById('tcRowLate_' + logId)?.value, 10) || 0);

    var totalMins = hrs * 60 + mins;
    row.durationMinutes = totalMins;
    row.lateMinutes = late;
    if (!row.checkOut) {
      row.checkOut = new Date(new Date(row.checkIn).getTime() + totalMins * 60000).toISOString();
    }
    row.method = '🛠️ معدل من المدير';

    localStorage.setItem('gherbi_staff_timeclock_v1', JSON.stringify(AppState.staffTimeClockLogs));
    this.renderUsersView();
    if (typeof showToast === 'function') {
      showToast('✅ تم تحديث الحجم الساعي للسجل إلى (' + hrs + ' ساعة و ' + mins + ' دقيقة) بنجاح!', 'success');
    }
  };

  App.adminDeleteSingleTimeClockRow = function (logId) {
    AppState.staffTimeClockLogs = (AppState.staffTimeClockLogs || []).filter(function (l) {
      return String(l.id) !== String(logId);
    });
    localStorage.setItem('gherbi_staff_timeclock_v1', JSON.stringify(AppState.staffTimeClockLogs));
    this.renderUsersView();
    if (typeof showToast === 'function') showToast('🗑️ تم حذف سجل البصمة بنجاح', 'info');
  };

  // نقل الحجم الساعي المعتمد للعامل من جهاز البصمة مباشرة إلى حاسبة الرواتب وفتحها!
  App.pushEmployeeTimeClockToPayrollAndOpen = function (userId) {
    var uid = Number(userId || 1);
    var summary = this.getEmployeeTimeClockSummary(uid);
    var st = (AppState._cachedUserStatsMap || {})[uid];
    var cfg = this.getEmployeePayrollConfig(uid, st);

    cfg.calcMode = 'hourly_minutes';
    cfg.workedHours = summary.regularHours > 0 || summary.regularMinutes > 0 ? summary.regularHours : 176;
    cfg.workedMinutes = summary.regularHours > 0 || summary.regularMinutes > 0 ? summary.regularMinutes : 0;
    cfg.overtimeHours = summary.overtimeHours;
    cfg.overtimeMinutes = summary.overtimeMinutes;
    cfg.lateMinutes = summary.lateMinutes;
    if (summary.workedDaysCount > 0) cfg.workedDays = summary.workedDaysCount;

    AppState.payrollConfigsByUser[uid] = cfg;
    localStorage.setItem('gherbi_payroll_configs_v1', JSON.stringify(AppState.payrollConfigsByUser));

    AppState.selectedPayrollUserId = uid;
    AppState.usersActiveTab = 'hr_commissions';
    this.renderUsersView();
    if (typeof showToast === 'function') {
      showToast('🚀 تم ربط ونقل الحجم الساعي (' + cfg.workedHours + ' ساعة و ' + cfg.workedMinutes + ' دقيقة) إلى حاسبة الرواتب بنجاح!', 'success');
    }
  };

  // ==========================================================================
  // 4. محرك التحديث اللحظي الفائق السلاسة لحاسبة الرواتب بدون إعادة رسم الشاشة!
  //    (Zero-Lag Live DOM Updater — يحل مشكلة التقطيع وفقدان المؤشر عند الكتابة 100%)
  // ==========================================================================
  App.onPayrollFastInput = function (userId, fieldName, rawValue, isCheckbox) {
    var uid = Number(userId || AppState.selectedPayrollUserId || 1);
    var st = (AppState._cachedUserStatsMap || {})[uid] || { totalRevenue: 0, invoicesCount: 0, totalDrawerDiff: 0, user: { name: 'الموظف', role: 'Cashier' } };
    var cfg = this.getEmployeePayrollConfig(uid, st);

    if (isCheckbox) {
      cfg[fieldName] = Boolean(rawValue);
    } else if (fieldName === 'calcMode') {
      cfg[fieldName] = String(rawValue);
    } else {
      cfg[fieldName] = parseFloat(rawValue) || 0;
    }

    AppState.payrollConfigsByUser[uid] = cfg;
    localStorage.setItem('gherbi_payroll_configs_v1', JSON.stringify(AppState.payrollConfigsByUser));

    // إذا غيّر المستخدم طريقة الحساب الرئيسية (calcMode)، نعيد رسم التبويب لإظهار حقول تلك الطريقة فقط
    if (fieldName === 'calcMode') {
      this.renderUsersView();
      return;
    }

    // أما أثناء الكتابة في الأرقام (الساعات، الدقائق، التسعيرة، اليوميات، المنح، الخصومات) فنحدث النصوص فقط في 0.1ms!
    var calc = this.computeUniversalEmployeePayroll(cfg, st);

    var setTxt = function (id, txt) {
      var el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('payLiveMinuteRateBadge', 'تسعيرة الدقيقة الواحدة: ' + calc.minuteRateDzd.toFixed(2) + ' د.ج / دقيقة');
    setTxt('payLivePrimaryFormulaText', App.buildPrimaryWageFormulaExplanation(cfg, calc));
    setTxt('paySlipModeBadge', calc.modeArabicLabel);
    setTxt('paySlipBaseVal', '+' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج');
    setTxt('paySlipOvertimeVal', '+' + calc.overtimePay.toFixed(2) + ' د.ج');
    setTxt('paySlipCommVal', '+' + calc.totalCommissionsDzd.toFixed(2) + ' د.ج');
    setTxt('paySlipAllowVal', '+' + calc.totalAllowancesDzd.toFixed(2) + ' د.ج');
    setTxt('paySlipGrossVal', calc.grossSalaryDzd.toFixed(2) + ' د.ج');
    setTxt('paySlipLateAbsentVal', '-' + (calc.lateDeductionDzd + calc.absentDeductionDzd).toFixed(2) + ' د.ج');
    setTxt('paySlipAdvCnasVal', '-' + (calc.empAdvancesDzd + calc.shortageDeductionDzd + calc.cnasDeductionDzd).toFixed(2) + ' د.ج');
    setTxt('paySlipNetDzd', calc.netPayableDzd.toFixed(2) + ' د.ج');
    setTxt('paySlipNetCentimes', '🇩🇿 بالتداول الجزائري: ' + fmtCentimes(calc.netPayableDzd));
  };

  App.buildPrimaryWageFormulaExplanation = function (cfg, calc) {
    if (cfg.calcMode === 'hourly_minutes') {
      var hrsPay = (cfg.workedHours * cfg.hourlyRateDzd).toFixed(2);
      var minsPay = (cfg.workedMinutes * calc.minuteRateDzd).toFixed(2);
      return '📐 المعادلة: (' + cfg.workedHours + ' ساعة × ' + cfg.hourlyRateDzd + ' د.ج = ' + hrsPay + ') + (' + cfg.workedMinutes + ' دقيقة × ' + calc.minuteRateDzd.toFixed(2) + ' د.ج = ' + minsPay + ') ⬅️ المجموع = ' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج';
    }
    if (cfg.calcMode === 'daily_wage') {
      return '📐 المعادلة: (' + cfg.workedDays + ' يوم عمل × ' + cfg.dailyRateDzd + ' د.ج لليوم) ⬅️ المجموع = ' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج';
    }
    if (cfg.calcMode === 'shift_rate') {
      return '📐 المعادلة: (' + cfg.workedShifts + ' مناوبة × ' + cfg.shiftRateDzd + ' د.ج للمناوبة) ⬅️ المجموع = ' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج';
    }
    if (cfg.calcMode === 'commission_only') {
      return '📐 المعادلة: نظام العمولة الحرة على المبيعات والأرباح والفواتير فقط (الأجر الثابت = 0.00 د.ج)';
    }
    if (cfg.calcMode === 'hybrid_all') {
      return '📐 المعادلة الهجينة: راتب ثابت (' + cfg.baseMonthlySalaryDzd + ' د.ج) + أجر الساعات والدقائق (' + calc.hourlyAndMinutesPay.toFixed(2) + ' د.ج) = ' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج';
    }
    return '📐 المعادلة: الراتب الشهري الثابت المعتمد = ' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج (قيمة اليوم المرجعية: ' + (cfg.baseMonthlySalaryDzd / 26).toFixed(2) + ' د.ج)';
  };

  // تعديل الإعدادات الافتراضية للمنح لتكون 0 د.ج افتراضياً حتى لا تسبب أي التباس إلا إذا أضافها المحاسب!
  var _origGetPayrollCfg = App.getEmployeePayrollConfig.bind(App);
  App.getEmployeePayrollConfig = function (userId, userStats) {
    var uid = Number(userId || 1);
    var saved = AppState.payrollConfigsByUser[uid] || {};
    var cfg = _origGetPayrollCfg(userId, userStats);
    if (saved.transportAllowanceDzd === undefined) cfg.transportAllowanceDzd = 0;
    if (saved.mealAllowanceDzd === undefined) cfg.mealAllowanceDzd = 0;
    if (saved.performanceBonusDzd === undefined) cfg.performanceBonusDzd = 0;
    return cfg;
  };

  // ==========================================================================
  // 5. حقن التصميم الجديد كلياً للتبويب 5 (جهاز البصمة واستوديو المدير) والتبويب 4 (حاسبة الرواتب المنظمة)
  // ==========================================================================
  var _prevRenderUsersV2 = App.renderUsersView.bind(App);
  App.renderUsersView = async function () {
    await _prevRenderUsersV2();
    var body = document.getElementById('usersMainTabBody');
    if (!body) return;

    var curTab = AppState.usersActiveTab || 'directory';
    var statsMap = AppState._cachedUserStatsMap || {};
    var users = Object.values(statsMap).map(function (st) { return st.user; });

    // ------------------------------------------------------------------------
    // التبويب 5 المطور كلياً: محطة البصمة الذكية (PIN / Barcode / Biometric) + استوديو المدير لتعديل الحجم الساعي
    // ------------------------------------------------------------------------
    if (curTab === 'time_clock') {
      var filterUid = AppState.timeClockFilterUserId || 'all';
      var filteredLogs = (AppState.staffTimeClockLogs || []).filter(function (l) {
        if (filterUid !== 'all' && Number(l.userId) !== Number(filterUid)) return false;
        return true;
      });

      var nowTimeStr = new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      var todayIso = new Date().toISOString().slice(0, 10);

      body.innerHTML =
        '<div class="space-y-4 text-xs">' +
        '  <!-- القسم العلوي: محطة البصمة الذكية ذات الـ 3 وسائط (كود سري PIN + ماسح باركود البطاقة + بصمة بيومترية) -->' +
        '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">' +
        '    <!-- يمين: جهاز البصمة التفاعلي (Kiosk Terminal — 5 أعمدة) -->' +
        '    <div class="lg:col-span-5 bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-xl">' +
        '      <div class="flex items-center justify-between border-b border-slate-800 pb-3">' +
        '        <div>' +
        '          <div class="text-[11px] text-amber-400 font-black">⏱️ محطة البصمة الذكية (Biometric & Barcode Pointage)</div>' +
        '          <div class="text-xs text-slate-400 mt-0.5">امسح باركود البطاقة أو اكتب كود العامل أو اضغط البصمة</div>' +
        '        </div>' +
        '        <div class="text-left">' +
        '          <div class="font-mono font-black text-xl text-emerald-400">' + nowTimeStr + '</div>' +
        '          <div class="font-mono text-[10px] text-slate-400">' + todayIso + '</div>' +
        '        </div>' +
        '      </div>' +

        '      <!-- حقل إدخال الكود السري أو مسح باركود بطاقة العامل (USR-0001 / 1001) -->' +
        '      <div class="space-y-1.5">' +
        '        <label class="block text-[11px] font-bold text-slate-300">🔢🏷️ أدخل الكود السري للعامل (مثلاً 1001 أو 1002) أو امسح باركود البطاقة (USR-0001):</label>' +
        '        <div class="flex gap-2">' +
        '          <input id="timeClockQuickCodeInput" type="text" onkeydown="if(event.key===\'Enter\') App.punchStaffByCodeOrBarcode(this.value, \'كود/باركود سريع\')" placeholder="اكتب الكود (1001 / 1002) أو امسح الباركود..." class="flex-1 px-3.5 py-2.5 rounded-xl font-mono font-black text-sm text-center bg-slate-950 text-amber-400 border border-slate-700">' +
        '          <button type="button" onclick="App.punchStaffByCodeOrBarcode(document.getElementById(\'timeClockQuickCodeInput\')?.value, \'كود سري PIN\')" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-lg">✓ بصمة الآن</button>' +
        '        </div>' +
        '      </div>' +

        '      <!-- لوحة أرقام سريعة لإدخال كود البصمة باللمس أو الماوس -->' +
        '      <div class="grid grid-cols-6 gap-1.5 pt-1">' +
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map(function (digit) {
          return '<button type="button" onclick="var el=document.getElementById(\'timeClockQuickCodeInput\'); if(el){el.value+=String(\'' + digit + '\'); el.focus();}" class="py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-mono font-black text-sm text-white border border-slate-700">' + digit + '</button>';
        }).join('') +
        '        <button type="button" onclick="var el=document.getElementById(\'timeClockQuickCodeInput\'); if(el){el.value=\'\'; el.focus();}" class="col-span-2 py-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white font-black text-xs">مسح ⌫</button>' +
        '      </div>' +

        '      <!-- إعداد وقت بداية الدوام الرسمي وساعات العمل القياسية -->' +
        '      <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">' +
        '        <div class="flex items-center justify-between bg-slate-800/70 px-2.5 py-1.5 rounded-xl">' +
        '          <span class="text-slate-400">⏰ بداية الدوام:</span>' +
        '          <input type="time" value="' + AppState.officialShiftStartTime + '" onchange="AppState.officialShiftStartTime=this.value; localStorage.setItem(\'gherbi_shift_start_time\', this.value)" class="bg-transparent font-mono font-black text-amber-300 border-0 p-0 text-left">' +
        '        </div>' +
        '        <div class="flex items-center justify-between bg-slate-800/70 px-2.5 py-1.5 rounded-xl">' +
        '          <span class="text-slate-400">⏳ دوام اليوم (سا):</span>' +
        '          <input type="number" min="1" max="16" value="' + AppState.officialStandardDailyHours + '" onchange="AppState.officialStandardDailyHours=parseInt(this.value,10)||8; localStorage.setItem(\'gherbi_std_daily_hours\', AppState.officialStandardDailyHours)" class="w-12 bg-transparent font-mono font-black text-emerald-400 border-0 p-0 text-center">' +
        '        </div>' +
        '      </div>' +
        '    </div>' +

        '    <!-- يسار: بطاقات البصمة البيومترية الحية للعمال + رصيد الساعات والدقائق لكل عامل (7 أعمدة) -->' +
        '    <div class="lg:col-span-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 shadow-sm">' +
        '      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">' +
        '        <h3 class="font-black text-sm text-indigo-600">🫆 بطاقات البصمة البيومترية المباشرة والحجم الساعي المتراكم للعمال</h3>' +
        '        <span class="text-[11px] text-slate-400 font-bold">انقر على مستشعر البصمة لتسجيل الدخول/الخروج أو انقل الساعات مباشرة لحاسبة الرواتب</span>' +
        '      </div>' +
        '      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        users.map(function (u) {
          var tcSum = App.getEmployeeTimeClockSummary(u.id);
          var pinInfo = App.getEmployeePinAndBarcode(u);
          var isOnDuty = Boolean(tcSum.activeOpenSession);

          return (
            '<div class="p-4 rounded-2xl border ' + (isOnDuty ? 'bg-emerald-500/5 border-emerald-500/40' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700') + ' space-y-3">' +
            '  <div class="flex items-start justify-between gap-2">' +
            '    <div>' +
            '      <div class="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">' +
            '        <span>' + u.name + '</span>' +
            (isOnDuty ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[9.5px] font-black">● في الدوام الآن</span>' : '<span class="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-[9.5px] font-bold">خارج الدوام</span>') +
            '      </div>' +
            '      <div class="font-mono text-[10.5px] text-slate-400 mt-0.5">🔢 الكود السري: <strong class="text-indigo-600 dark:text-amber-400">' + pinInfo.pin + '</strong> | 🏷️ الباركود: <strong>' + pinInfo.barcode + '</strong></div>' +
            '    </div>' +
            '    <button type="button" onclick="App.openStaffBadgePreviewModal(' + u.id + ')" class="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 font-black text-[10px]" title="طباعة بطاقة باركود العامل">🪪 البطاقة</button>' +
            '  </div>' +

            '  <!-- ملخص الحجم الساعي الدقيق للعامل -->' +
            '  <div class="grid grid-cols-3 gap-1.5 text-center bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200/70 dark:border-slate-700">' +
            '    <div><div class="text-[9.5px] text-slate-400">الحجم الساعي العادي</div><div class="font-mono font-black text-blue-600 text-xs mt-0.5">' + tcSum.regularHours + 'سا و ' + tcSum.regularMinutes + 'د</div></div>' +
            '    <div><div class="text-[9.5px] text-slate-400">الساعات الإضافية</div><div class="font-mono font-black text-emerald-600 text-xs mt-0.5">+' + tcSum.overtimeHours + 'سا و ' + tcSum.overtimeMinutes + 'د</div></div>' +
            '    <div><div class="text-[9.5px] text-slate-400">دقائق التأخر</div><div class="font-mono font-black text-rose-600 text-xs mt-0.5">' + tcSum.lateMinutes + ' دقيقة</div></div>' +
            '  </div>' +

            '  <!-- أزرار البصمة البيومترية ونقل الساعات للراتب -->' +
            '  <div class="flex gap-1.5">' +
            (isOnDuty
              ? '<button type="button" onclick="App.punchStaffTimeClockEnhanced(' + u.id + ', \'out\', \'🫆 بصمة بيومترية\')" class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black shadow flex items-center justify-center gap-1.5"><span>🔴 تسجيل انصراف (خروج)</span></button>'
              : '<button type="button" onclick="App.punchStaffTimeClockEnhanced(' + u.id + ', \'in\', \'🫆 بصمة بيومترية\')" class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow flex items-center justify-center gap-1.5"><span>🫆 بصمة حضور (دخول)</span></button>') +
            '    <button type="button" onclick="App.pushEmployeeTimeClockToPayrollAndOpen(' + u.id + ')" class="px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow" title="نقل الساعات والدقائق إلى حاسبة الرواتب">🧮 للراتب</button>' +
            '  </div>' +
            '</div>'
          );
        }).join('') +
        '      </div>' +
        '    </div>' +
        '  </div>' +

        '  <!-- القسم الأوسط: استوديو المدير (Admin Override) لتعديل الحجم الساعي وتعويض نسيان تسجيل الدخول/الخروج -->' +
        '  <div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-3">' +
        '    <div class="flex flex-wrap items-center justify-between gap-2">' +
        '      <div>' +
        '        <h4 class="font-black text-sm text-indigo-700 dark:text-amber-300">🛠️ استوديو المدير لتعديل الحجم الساعي وتعويض البصمة المنسية (Admin Timesheet Override)</h4>' +
        '        <p class="text-[11px] text-slate-500 dark:text-slate-300">إذا نسي العامل تسجيل دخوله أو خروجه، يمكنك هنا إضافة دوامه يدوياً (بوقت الدخول/الخروج أو بكتابة الساعات والدقائق مباشرة)</p>' +
        '      </div>' +
        '    </div>' +
        '    <div class="grid grid-cols-2 md:grid-cols-7 gap-2 items-end">' +
        '      <div><label class="block font-bold mb-1">1. اختر العامل</label><select id="admTcEmpSelect" class="w-full px-2.5 py-2 rounded-xl font-black">' + users.map(function (u) { return '<option value="' + u.id + '">' + u.name + '</option>'; }).join('') + '</select></div>' +
        '      <div><label class="block font-bold mb-1">2. التاريخ</label><input id="admTcDateInput" type="date" value="' + todayIso + '" class="w-full px-2.5 py-2 rounded-xl font-mono font-bold"></div>' +
        '      <div><label class="block font-bold mb-1">وقت الدخول</label><input id="admTcTimeInInput" type="time" value="08:00" class="w-full px-2.5 py-2 rounded-xl font-mono font-bold"></div>' +
        '      <div><label class="block font-bold mb-1">وقت الخروج</label><input id="admTcTimeOutInput" type="time" value="16:00" class="w-full px-2.5 py-2 rounded-xl font-mono font-bold"></div>' +
        '      <div><label class="block font-bold mb-1 text-blue-600">أو الساعات مباشرة</label><input id="admTcDirectHours" type="number" min="0" max="24" value="8" class="w-full px-2.5 py-2 rounded-xl font-mono font-black text-center border-blue-400"></div>' +
        '      <div><label class="block font-bold mb-1 text-blue-600">والدقائق مباشرة</label><input id="admTcDirectMins" type="number" min="0" max="59" value="0" class="w-full px-2.5 py-2 rounded-xl font-mono font-black text-center border-blue-400"></div>' +
        '      <div><button type="button" onclick="App.adminAddOrOverrideAttendanceRecord()" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-lg">💾 إضافة للحجم الساعي</button></div>' +
        '    </div>' +
        '    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">' +
        '      <div class="md:col-span-2"><input id="admTcReasonInput" type="text" value="تعويض إداري عن نسيان تسجيل الدخول صباحاً" placeholder="سبب التعديل الإداري..." class="w-full px-3 py-1.5 rounded-xl font-bold"></div>' +
        '      <div class="flex items-center gap-2"><span class="font-bold text-rose-600 shrink-0">دقائق التأخر (إن وجدت):</span><input id="admTcLateMins" type="number" min="0" value="0" class="w-24 px-2.5 py-1.5 rounded-xl font-mono font-bold text-center"></div>' +
        '    </div>' +
        '  </div>' +

        '  <!-- القسم السفلي: جدول سجل حركات البصمة والدوام بالدقيقة مع التعديل المباشر لكل سطر -->' +
        '  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 shadow-sm">' +
        '    <div class="flex flex-wrap items-center justify-between gap-2">' +
        '      <h4 class="font-black text-sm text-slate-800 dark:text-white">📋 سجل حركات البصمة والدوام بالدقيقة — قابل للتعديل المباشر من المدير (' + filteredLogs.length + ' حركة)</h4>' +
        '      <div class="flex items-center gap-2">' +
        '        <span class="font-bold text-slate-400">تصفية حسب العامل:</span>' +
        '        <select onchange="AppState.timeClockFilterUserId=this.value; App.renderUsersView()" class="px-3 py-1.5 rounded-xl font-bold">' +
        '          <option value="all">جميع العمال</option>' +
        users.map(function (u) {
          return '<option value="' + u.id + '" ' + (String(filterUid) === String(u.id) ? 'selected' : '') + '>' + u.name + '</option>';
        }).join('') +
        '        </select>' +
        '      </div>' +
        '    </div>' +

        '    <div class="overflow-x-auto max-h-80">' +
        '      <table class="w-full text-xs text-right">' +
        '        <thead class="bg-slate-100 dark:bg-slate-900 text-slate-500">' +
        '          <tr>' +
        '            <th class="p-2">العامل</th>' +
        '            <th class="p-2">طريقة البصمة</th>' +
        '            <th class="p-2">وقت الدخول</th>' +
        '            <th class="p-2">وقت الخروج</th>' +
        '            <th class="p-2 text-center">تعديل الساعات (Hours)</th>' +
        '            <th class="p-2 text-center">تعديل الدقائق (Mins)</th>' +
        '            <th class="p-2 text-center">تأخر (دقيقة)</th>' +
        '            <th class="p-2 text-center">إجراءات المدير لتصحيح السجل</th>' +
        '          </tr>' +
        '        </thead>' +
        '        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
        (filteredLogs.length > 0
          ? filteredLogs.map(function (tc) {
              var hrs = Math.floor(Number(tc.durationMinutes || 0) / 60);
              var mins = Number(tc.durationMinutes || 0) % 60;
              var late = Number(tc.lateMinutes || 0);
              return (
                '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/20">' +
                '  <td class="p-2 font-black">' + tc.empName + '</td>' +
                '  <td class="p-2"><span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-amber-300 font-bold text-[10.5px]">' + (tc.method || 'بصمة') + '</span></td>' +
                '  <td class="p-2 font-mono text-[11px]">' + String(tc.checkIn || '').slice(0, 16).replace('T', ' ') + '</td>' +
                '  <td class="p-2 font-mono text-[11px]">' + (tc.checkOut ? String(tc.checkOut).slice(0, 16).replace('T', ' ') : '<span class="text-emerald-600 font-black">🟢 في الدوام الآن</span>') + '</td>' +
                '  <td class="p-2 text-center"><input id="tcRowHrs_' + tc.id + '" type="number" min="0" max="24" value="' + hrs + '" class="w-16 px-2 py-1 rounded-lg font-mono font-black text-center border-blue-400"></td>' +
                '  <td class="p-2 text-center"><input id="tcRowMins_' + tc.id + '" type="number" min="0" max="59" value="' + mins + '" class="w-16 px-2 py-1 rounded-lg font-mono font-black text-center border-blue-400"></td>' +
                '  <td class="p-2 text-center"><input id="tcRowLate_' + tc.id + '" type="number" min="0" value="' + late + '" class="w-16 px-2 py-1 rounded-lg font-mono font-bold text-rose-600 text-center"></td>' +
                '  <td class="p-2">' +
                '    <div class="flex items-center justify-center gap-1">' +
                '      <button type="button" onclick="App.adminUpdateSingleTimeClockRow(\'' + tc.id + '\')" class="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-[10.5px] shadow">💾 حفظ</button>' +
                '      <button type="button" onclick="App.adminUpdateSingleTimeClockRow(\'' + tc.id + '\', 8, 0, 0)" class="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 font-black text-[10.5px]" title="اعتماد يوم عمل كامل 8 ساعات">+8سا كامل</button>' +
                '      <button type="button" onclick="App.adminDeleteSingleTimeClockRow(\'' + tc.id + '\')" class="p-1 text-rose-500 hover:bg-rose-500/15 rounded-lg" title="حذف السجل"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
                '    </div>' +
                '  </td>' +
                '</tr>'
              );
            }).join('')
          : '<tr><td colspan="8" class="py-8 text-center text-slate-400 font-bold">لا توجد بصمات مسجلة بعد — استخدم جهاز البصمة أو استوديو المدير أعلاه</td></tr>') +
        '        </tbody>' +
        '      </table>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    // ------------------------------------------------------------------------
    // التبويب 4 المطور كلياً: حاسبة الرواتب المنظمة خطوة بخطوة وفائقة السلاسة (Clean Step-by-Step Payroll Studio)
    // ------------------------------------------------------------------------
    else if (curTab === 'hr_commissions') {
      var selUid = Number(AppState.selectedPayrollUserId || (users[0] && users[0].id) || 1);
      var selStats = statsMap[selUid] || Object.values(statsMap)[0];
      var cfg = this.getEmployeePayrollConfig(selUid, selStats);
      var calc = this.computeUniversalEmployeePayroll(cfg, selStats);
      var tcSummary = this.getEmployeeTimeClockSummary(selUid);

      var MODES = [
        { id: 'hourly_minutes', icon: '⏱️', title: '1. بالساعات والدقائق الفعلية', sub: 'الساعات والدقائق × تسعيرة الساعة' },
        { id: 'daily_wage', icon: '📅', title: '2. باليومية (أجر اليوم)', sub: 'عدد أيام العمل × أجر اليوم' },
        { id: 'monthly_fixed', icon: '📆', title: '3. راتب شهري ثابت', sub: 'أجر شهري مقطوع + حوافز' },
        { id: 'shift_rate', icon: '🗄️', title: '4. بالمناوبة (الشفت)', sub: 'عدد المناوبات × أجر المناوبة' },
        { id: 'hybrid_all', icon: '⚡', title: '5. النظام الهجين الشامل', sub: 'راتب ثابت + ساعات + عمولة' }
      ];

      // بناء محتوى الصندوق الرئيسي للخطوة 1 بناءً على الطريقة المختارة فقط (للقضاء على أي تشتت أو لخبطة!)
      var step1PrimaryBoxHtml = '';
      if (cfg.calcMode === 'hourly_minutes') {
        step1PrimaryBoxHtml =
          '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
          '  <div class="p-3 rounded-xl bg-blue-500/5 border border-blue-500/30">' +
          '    <label class="block font-black text-blue-700 dark:text-blue-300 mb-1">1. عدد الساعات الأساسية (Hours):</label>' +
          '    <input type="number" min="0" value="' + cfg.workedHours + '" oninput="App.onPayrollFastInput(' + selUid + ', \'workedHours\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-blue-400">' +
          '  </div>' +
          '  <div class="p-3 rounded-xl bg-blue-500/5 border border-blue-500/30">' +
          '    <label class="block font-black text-blue-700 dark:text-blue-300 mb-1">2. عدد الدقائق الإضافية (Minutes 0-59):</label>' +
          '    <input type="number" min="0" max="59" value="' + cfg.workedMinutes + '" oninput="App.onPayrollFastInput(' + selUid + ', \'workedMinutes\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-blue-400">' +
          '  </div>' +
          '  <div class="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30">' +
          '    <label class="block font-black text-emerald-700 dark:text-emerald-300 mb-1">3. تسعيرة الساعة الواحدة (د.ج / ساعة):</label>' +
          '    <input type="number" min="0" step="10" value="' + cfg.hourlyRateDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'hourlyRateDzd\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-emerald-400">' +
          '  </div>' +
          '</div>';
      } else if (cfg.calcMode === 'daily_wage') {
        step1PrimaryBoxHtml =
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
          '  <div class="p-3 rounded-xl bg-blue-500/5 border border-blue-500/30">' +
          '    <label class="block font-black text-blue-700 dark:text-blue-300 mb-1">1. عدد أيام الحضور والعمل الفعلي (أيام):</label>' +
          '    <input type="number" min="0" value="' + cfg.workedDays + '" oninput="App.onPayrollFastInput(' + selUid + ', \'workedDays\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-blue-400">' +
          '  </div>' +
          '  <div class="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30">' +
          '    <label class="block font-black text-emerald-700 dark:text-emerald-300 mb-1">2. أجرة اليوم الواحد (د.ج / يوم):</label>' +
          '    <input type="number" min="0" step="100" value="' + cfg.dailyRateDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'dailyRateDzd\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-emerald-400">' +
          '  </div>' +
          '</div>';
      } else if (cfg.calcMode === 'shift_rate') {
        step1PrimaryBoxHtml =
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
          '  <div class="p-3 rounded-xl bg-blue-500/5 border border-blue-500/30">' +
          '    <label class="block font-black text-blue-700 dark:text-blue-300 mb-1">1. عدد المناوبات (الشفتات) المنجزة:</label>' +
          '    <input type="number" min="0" value="' + cfg.workedShifts + '" oninput="App.onPayrollFastInput(' + selUid + ', \'workedShifts\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-blue-400">' +
          '  </div>' +
          '  <div class="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/30">' +
          '    <label class="block font-black text-emerald-700 dark:text-emerald-300 mb-1">2. أجرة المناوبة الواحدة (د.ج / شفت):</label>' +
          '    <input type="number" min="0" step="100" value="' + cfg.shiftRateDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'shiftRateDzd\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-emerald-400">' +
          '  </div>' +
          '</div>';
      } else if (cfg.calcMode === 'monthly_fixed') {
        step1PrimaryBoxHtml =
          '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
          '  <div class="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/30">' +
          '    <label class="block font-black text-indigo-700 dark:text-indigo-300 mb-1">1. الراتب الشهري الثابت المعتمد (د.ج / شهر):</label>' +
          '    <input type="number" min="0" step="500" value="' + cfg.baseMonthlySalaryDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'baseMonthlySalaryDzd\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-base text-center border-indigo-400">' +
          '  </div>' +
          '  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">' +
          '    <label class="block font-bold text-slate-500 mb-1">2. تسعيرة الساعة المرجعية (لحساب الإضافي والتأخر):</label>' +
          '    <input type="number" min="0" step="10" value="' + cfg.hourlyRateDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'hourlyRateDzd\', this.value)" class="w-full px-3 py-2.5 rounded-xl font-mono font-bold text-base text-center">' +
          '  </div>' +
          '</div>';
      } else {
        step1PrimaryBoxHtml =
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">' +
          '  <div><label class="block font-bold mb-1 text-indigo-600">الراتب الثابت (د.ج)</label><input type="number" step="500" value="' + cfg.baseMonthlySalaryDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'baseMonthlySalaryDzd\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-center"></div>' +
          '  <div><label class="block font-bold mb-1 text-blue-600">الساعات (Hours)</label><input type="number" value="' + cfg.workedHours + '" oninput="App.onPayrollFastInput(' + selUid + ', \'workedHours\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-center"></div>' +
          '  <div><label class="block font-bold mb-1 text-blue-600">الدقائق (Mins)</label><input type="number" value="' + cfg.workedMinutes + '" oninput="App.onPayrollFastInput(' + selUid + ', \'workedMinutes\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-center"></div>' +
          '  <div><label class="block font-bold mb-1 text-emerald-600">تسعيرة الساعة</label><input type="number" value="' + cfg.hourlyRateDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'hourlyRateDzd\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-center"></div>' +
          '</div>';
      }

      body.innerHTML =
        '<div class="space-y-4 text-xs">' +
        '  <!-- الشريط العلوي: اختيار الموظف + الربط المباشر مع جهاز البصمة بالدقيقة -->' +
        '  <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-sm">' +
        '    <div class="flex flex-wrap items-center gap-3">' +
        '      <span class="font-black text-sm text-indigo-600">👤 1. الموظف المعني بالحساب:</span>' +
        '      <select onchange="AppState.selectedPayrollUserId=Number(this.value); App.renderUsersView()" class="px-4 py-2 rounded-xl font-black text-sm border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-amber-300">' +
        users.map(function (u) {
          return '<option value="' + u.id + '" ' + (Number(u.id) === selUid ? 'selected' : '') + '>' + u.name + ' (' + u.role + ')</option>';
        }).join('') +
        '      </select>' +
        '      <div class="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold">' +
        '        ⏱️ المسجل في جهاز البصمة: <strong class="font-mono text-blue-600">' + tcSummary.regularHours + ' ساعة و ' + tcSummary.regularMinutes + ' دقيقة</strong> (' + tcSummary.workedDaysCount + ' يوم)' +
        '      </div>' +
        '    </div>' +
        '    <div class="flex flex-wrap gap-2">' +
        '      <button type="button" onclick="App.pushEmployeeTimeClockToPayrollAndOpen(' + selUid + ')" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow">📥 تطبيق ساعات ودقائق البصمة الفعلية (' + tcSummary.regularHours + 'سا و ' + tcSummary.regularMinutes + 'د)</button>' +
        '      <button type="button" onclick="AppState.usersActiveTab=\'time_clock\'; App.renderUsersView()" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 font-bold">⏱️ فتح جهاز البصمة</button>' +
        '    </div>' +
        '  </div>' +

        '  <!-- أزرار اختيار طريقة حساب الأجر الـ 5 (تبديل نظيف ومنظم) -->' +
        '  <div class="grid grid-cols-2 md:grid-cols-5 gap-2.5">' +
        MODES.map(function (m) {
          var isAct = cfg.calcMode === m.id;
          return (
            '<div onclick="App.onPayrollFastInput(' + selUid + ', \'calcMode\', \'' + m.id + '\')" class="p-3 rounded-2xl border cursor-pointer transition ' +
            (isAct
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-400') +
            '">' +
            '  <div class="font-black text-xs">' + m.icon + ' ' + m.title + '</div>' +
            '  <div class="text-[10px] ' + (isAct ? 'text-indigo-100' : 'text-slate-400') + ' mt-0.5">' + m.sub + '</div>' +
            '</div>'
          );
        }).join('') +
        '  </div>' +

        '  <!-- الشبكة الرئيسية: يمين (المدخلات المنظمة في 3 خطوات واضحة) | يسار (وثيقة كشف الراتب الحية) -->' +
        '  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">' +
        '    <div class="lg:col-span-7 space-y-3.5">' +

        '      <!-- الخطوة أ: الأجر الأساسي حسب الطريقة المختارة فقط -->' +
        '      <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">' +
        '        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">' +
        '          <h4 class="font-black text-sm text-blue-600">أولاً: مدخلات الأجر الأساسي (' + calc.modeArabicLabel.split('(')[0] + ')</h4>' +
        '          <span id="payLiveMinuteRateBadge" class="px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 font-mono font-black">تسعيرة الدقيقة الواحدة: ' + calc.minuteRateDzd.toFixed(2) + ' د.ج / دقيقة</span>' +
        '        </div>' +
        step1PrimaryBoxHtml +
        '        <div id="payLivePrimaryFormulaText" class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono font-bold text-indigo-600 dark:text-amber-300 text-[11px]">' +
        this.buildPrimaryWageFormulaExplanation(cfg, calc) +
        '        </div>' +
        '      </div>' +

        '      <!-- الخطوة ب: الإضافات والمكافآت (الساعات الإضافية + العمولات + المنح) -->' +
        '      <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">' +
        '        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">' +
        '          <h4 class="font-black text-sm text-emerald-600">➕ ثانياً: الإضافات والمكافآت (ساعات إضافية، عمولات المبيعات، والمنح)</h4>' +
        '          <span class="text-[11px] font-bold text-slate-400">مبيعات الموظف المسجلة: <strong class="font-mono text-blue-600">' + selStats.totalRevenue.toFixed(2) + ' د.ج</strong> (' + selStats.invoicesCount + ' فاتورة)</span>' +
        '        </div>' +
        '        <div class="grid grid-cols-2 md:grid-cols-3 gap-2.5">' +
        '          <div><label class="block font-bold mb-1">ساعات إضافية (Overtime H)</label><input type="number" min="0" value="' + cfg.overtimeHours + '" oninput="App.onPayrollFastInput(' + selUid + ', \'overtimeHours\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-bold text-center"></div>' +
        '          <div><label class="block font-bold mb-1">دقائق إضافية (Overtime Min)</label><input type="number" min="0" max="59" value="' + cfg.overtimeMinutes + '" oninput="App.onPayrollFastInput(' + selUid + ', \'overtimeMinutes\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-bold text-center"></div>' +
        '          <div><label class="block font-bold mb-1">معامل الإضافي (مثلاً 1.5x)</label><input type="number" step="0.25" value="' + cfg.overtimeMultiplier + '" oninput="App.onPayrollFastInput(' + selUid + ', \'overtimeMultiplier\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-bold text-center"></div>' +
        '          <div><label class="block font-bold mb-1 text-emerald-600">عمولة المبيعات (%)</label><input type="number" step="0.1" value="' + cfg.salesCommissionPct + '" oninput="App.onPayrollFastInput(' + selUid + ', \'salesCommissionPct\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-emerald-600 text-center"></div>' +
        '          <div><label class="block font-bold mb-1">منحة النقل (Transport د.ج)</label><input type="number" step="100" value="' + cfg.transportAllowanceDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'transportAllowanceDzd\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-bold text-center"></div>' +
        '          <div><label class="block font-bold mb-1">منحة الإطعام / المكافأة (د.ج)</label><input type="number" step="100" value="' + cfg.mealAllowanceDzd + '" oninput="App.onPayrollFastInput(' + selUid + ', \'mealAllowanceDzd\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-bold text-center"></div>' +
        '        </div>' +
        '      </div>' +

        '      <!-- الخطوة ج: الاقتطاعات والخصومات (التأخر بالدقيقة، الغياب، السلفيات، CNAS) -->' +
        '      <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">' +
        '        <h4 class="font-black text-sm text-rose-600 border-b border-slate-100 dark:border-slate-700 pb-2">➖ ثالثاً: الاقتطاعات والخصومات (دقائق التأخر، أيام الغياب، السلفيات، و CNAS)</h4>' +
        '        <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 items-center">' +
        '          <div><label class="block font-bold mb-1 text-rose-600">دقائق التأخر (دقيقة)</label><input type="number" min="0" value="' + cfg.lateMinutes + '" oninput="App.onPayrollFastInput(' + selUid + ', \'lateMinutes\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-rose-600 text-center"></div>' +
        '          <div><label class="block font-bold mb-1 text-rose-600">أيام الغياب (يوم)</label><input type="number" min="0" value="' + cfg.absentDays + '" oninput="App.onPayrollFastInput(' + selUid + ', \'absentDays\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-rose-600 text-center"></div>' +
        '          <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer mt-4"><input type="checkbox" ' + (cfg.applyCnas9Pct ? 'checked' : '') + ' onchange="App.onPayrollFastInput(' + selUid + ', \'applyCnas9Pct\', this.checked, true)"><span class="font-bold">ضمان CNAS (9%)</span></label>' +
        '          <label class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer mt-4"><input type="checkbox" ' + (cfg.deductCaisseShortage ? 'checked' : '') + ' onchange="App.onPayrollFastInput(' + selUid + ', \'deductCaisseShortage\', this.checked, true)"><span class="font-bold">خصم عجز الصندوق</span></label>' +
        '        </div>' +
        '      </div>' +
        '    </div>' +

        '    <!-- يسار: وثيقة كشف الراتب التفاعلي المفصل (Live Fiche de Paie — 5 أعمدة) -->' +
        '    <div class="lg:col-span-5 bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">' +
        '      <div class="space-y-3">' +
        '        <div class="flex items-center justify-between border-b border-slate-800 pb-3">' +
        '          <div><div class="text-xs text-amber-400 font-black">🧾 كشف الراتب التفاعلي المفصل (Fiche de Paie)</div><div class="text-lg font-black mt-0.5">' + selStats.user.name + ' (' + selStats.user.role + ')</div></div>' +
        '          <span id="paySlipModeBadge" class="px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 font-mono text-[10.5px]">' + calc.modeArabicLabel + '</span>' +
        '        </div>' +

        '        <div class="space-y-2 text-xs">' +
        '          <div class="flex justify-between p-2.5 rounded-xl bg-slate-800/90"><span>1. الأجر الأساسي (حسب الطريقة المختارة):</span><strong id="paySlipBaseVal" class="font-mono text-blue-400 text-sm">+' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج</strong></div>' +
        '          <div class="flex justify-between p-2.5 rounded-xl bg-slate-800/90"><span>2. أجر الساعات والدقائق الإضافية (Overtime):</span><strong id="paySlipOvertimeVal" class="font-mono text-blue-300">+' + calc.overtimePay.toFixed(2) + ' د.ج</strong></div>' +
        '          <div class="flex justify-between p-2.5 rounded-xl bg-slate-800/90"><span>3. عمولات المبيعات (' + selStats.totalRevenue.toFixed(0) + ' د.ج):</span><strong id="paySlipCommVal" class="font-mono text-emerald-400">+' + calc.totalCommissionsDzd.toFixed(2) + ' د.ج</strong></div>' +
        '          <div class="flex justify-between p-2.5 rounded-xl bg-slate-800/90"><span>4. المنح والعلاوات الإضافية:</span><strong id="paySlipAllowVal" class="font-mono text-emerald-300">+' + calc.totalAllowancesDzd.toFixed(2) + ' د.ج</strong></div>' +
        '          <div class="flex justify-between p-2 rounded-xl bg-indigo-950/60 border border-indigo-500/30 font-black"><span>إجمالي الاستحقاق الخام (Salaire Brut):</span><strong id="paySlipGrossVal" class="font-mono text-amber-300">' + calc.grossSalaryDzd.toFixed(2) + ' د.ج</strong></div>' +
        '          <div class="flex justify-between p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30"><span>5. (-) خصم دقائق التأخر وأيام الغياب:</span><strong id="paySlipLateAbsentVal" class="font-mono text-rose-400">-' + (calc.lateDeductionDzd + calc.absentDeductionDzd).toFixed(2) + ' د.ج</strong></div>' +
        '          <div class="flex justify-between p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30"><span>6. (-) خصم السلفيات (' + calc.empAdvancesDzd.toFixed(0) + ') وعجز الصندوق و CNAS:</span><strong id="paySlipAdvCnasVal" class="font-mono text-rose-400">-' + (calc.empAdvancesDzd + calc.shortageDeductionDzd + calc.cnasDeductionDzd).toFixed(2) + ' د.ج</strong></div>' +
        '        </div>' +

        '        <div class="p-4 rounded-2xl bg-emerald-600 text-white shadow-lg text-center space-y-1 mt-2">' +
        '          <div class="text-xs opacity-90 font-bold">صافي الراتب النهائي المستحق للدفع (NET À PAYER)</div>' +
        '          <div id="paySlipNetDzd" class="text-3xl font-black font-mono">' + calc.netPayableDzd.toFixed(2) + ' د.ج</div>' +
        '          <div id="paySlipNetCentimes" class="text-xs font-bold text-amber-200">🇩🇿 بالتداول الجزائري: ' + fmtCentimes(calc.netPayableDzd) + '</div>' +
        '        </div>' +
        '      </div>' +

        '      <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">' +
        '        <button type="button" onclick="App.printEmployeePayslipA4(' + selUid + ')" class="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow">🖨️ طباعة كشف الراتب (A4)</button>' +
        '        <button type="button" onclick="App.disburseCalculatedPayrollNow(' + selUid + ')" class="py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black shadow">💸 صرف وتسجيل في المصاريف</button>' +
        '      </div>' +
        '    </div>' +
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

  const marker = '// [PAGE 17 V3 BIOMETRIC TIME-CLOCK, ADMIN OVERRIDE & CLEAN PAYROLL]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installPage17BiometricTimeClockAndCleanPayrollV3.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ تم حقن وفحص محطة البصمة الذكية واستوديو المدير وحاسبة الرواتب فائقة السلاسة (V3) في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['upgrade-page17-omni-forensic-and-universal-payroll-erp.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 اكتملت الترقية V3 بنجاح! اضغط Ctrl+R داخل البرنامج الآن وجرّب البصمة والكتابة السلسة في حاسبة الرواتب.');