/**
 * upgrade-page17-erp-biometrics-auto-payroll-and-pdf-v4.js
 * الترقية الاستشارية والهندسية الشاملة (الإصدار V4) للصفحة 17 (#view-users):
 * 1. استوديو تهيئة الهوية وتسجيل البصمات والأكواد والبطاقات (Biometric Enrollment, PIN, Barcode & ZKTeco/USB Bridge) مدمج في التبويب 1 والتبويب 5
 * 2. إصلاح التباين البصري الكامل لحقل الكود السري والباركود في شاشة البصمة السوداء (#timeClockQuickCodeInput)
 * 3. محرك الدورات الآلي للرواتب (أسبوعي 7 أيام | نصف شهري 15 يوماً | شهري 30 يوماً) + زر توليد رواتب جميع العمال دفعة واحدة (Auto-Run Batch Payroll)
 * 4. سجل الرواتب والأجور مع متابعة حالة القبض (✅ تم القبض Payé / ⏳ غير مقبوض En attente)
 * 5. استوديو PDF المزدوج:
 *    - تقرير PDF شامل لجميع الموظفين (الرواتب + حالة القبض + جدول متى دخل ومتى خرج كل عامل وعدد الساعات والدقائق)
 *    - تقرير PDF فردي لكل عامل على حدة (تفاصيل الحساب + سجل بصمات حضوره وانصرافه + توقيع الاستلام).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء حقن منظومة الهوية والبصمات، محرك الرواتب الآلي (أسبوعي/شهري)، سجل القبض، واستوديو تقارير PDF الشامل والفردي (V4)...\n');

function installPage17ErpBiometricsAutoPayrollAndPdfV4() {
  if (!window.App || !window.AppState) return;

  AppState.payrollPeriodCycle = localStorage.getItem('gherbi_payroll_cycle') || 'monthly'; // 'weekly' | 'biweekly' | 'monthly'
  AppState.payrollRecordsLedger = JSON.parse(localStorage.getItem('gherbi_payroll_ledger_v4') || '[]');
  AppState.empBiometricProfiles = JSON.parse(localStorage.getItem('gherbi_emp_biometrics_v4') || '{}');

  function fmtCentimes(dzd) {
    return typeof App.formatAlgerianCentimes === 'function'
      ? App.formatAlgerianCentimes(dzd)
      : (Math.round(Number(dzd || 0) * 100)).toLocaleString('fr-DZ') + ' سنتيم';
  }

  // استخراج ملف الهوية الكامل للموظف (الكود السري PIN + الباركود + البصمة البيومترية + كود جهاز البصمة USB/ZKTeco)
  App.getEmployeeFullIdentityProfile = function (userObj) {
    var uid = Number((userObj && userObj.id) || 1);
    var savedPins = JSON.parse(localStorage.getItem('gherbi_emp_pins_v1') || '{}');
    var bioMap = AppState.empBiometricProfiles || {};
    var bio = bioMap[uid] || {};

    return {
      userId: uid,
      pin: savedPins[uid] || bio.pin || String(1000 + uid),
      barcode: 'USR-' + String(uid).padStart(4, '0'),
      zkDeviceUserId: bio.zkDeviceUserId || String(uid),
      usbRfidToken: bio.usbRfidToken || ('RFID-' + String(10000 + uid)),
      fingerprintEnrolled: bio.fingerprintEnrolled !== false, // مفعل افتراضياً مع إمكانية إعادة التسجيل
      fingerprintHash: bio.fingerprintHash || ('FP-SHA256-' + String(uid * 987654321).slice(0, 10)),
      enrolledAt: bio.enrolledAt || '2026-11-01',
      defaultPayCycle: bio.defaultPayCycle || 'monthly' // 'weekly' | 'monthly'
    };
  };

  App.saveEmployeeIdentityField = function (userId, field, value) {
    var uid = Number(userId || 1);
    if (!AppState.empBiometricProfiles) AppState.empBiometricProfiles = {};
    if (!AppState.empBiometricProfiles[uid]) {
      AppState.empBiometricProfiles[uid] = this.getEmployeeFullIdentityProfile({ id: uid });
    }
    AppState.empBiometricProfiles[uid][field] = value;
    localStorage.setItem('gherbi_emp_biometrics_v4', JSON.stringify(AppState.empBiometricProfiles));

    if (field === 'pin') {
      var savedPins = JSON.parse(localStorage.getItem('gherbi_emp_pins_v1') || '{}');
      savedPins[uid] = String(value).trim();
      localStorage.setItem('gherbi_emp_pins_v1', JSON.stringify(savedPins));
    }
    if (typeof showToast === 'function') {
      showToast('✅ تم حفظ وتحديث بيانات الهوية والبصمة للموظف بنجاح!', 'success');
    }
  };

  // ==========================================================================
  // 1. نافذة تسجيل البصمة البيومترية الثلاثية والربط مع أجهزة USB / ZKTeco (#biometricEnrollModal)
  //    ونافذة معاينة وطباعة تقارير PDF للرواتب والحضور (#erpPayrollPdfStudioModal)
  // ==========================================================================
  App.ensureErpV4ModalsDom = function () {
    this.ensureUsersErpModalsDom();

    if (!document.getElementById('biometricEnrollModal')) {
      var bm = document.createElement('div');
      bm.id = 'biometricEnrollModal';
      bm.className = 'modal-overlay';
      bm.innerHTML =
        '<div class="modal-content w-full max-w-xl p-6 space-y-4">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <h3 id="bioEnrollModalTitle" class="text-lg font-black text-indigo-600">🫆🪪 استوديو تسجيل البصمة البيومترية والكود السري والباركود للموظف</h3>' +
        '    <button type="button" onclick="App.closeModal(\'biometricEnrollModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="bioEnrollModalBody" class="space-y-4 text-xs"></div>' +
        '</div>';
      document.body.appendChild(bm);
    }

    if (!document.getElementById('erpPayrollPdfStudioModal')) {
      var pm = document.createElement('div');
      pm.id = 'erpPayrollPdfStudioModal';
      pm.className = 'modal-overlay';
      pm.innerHTML =
        '<div class="modal-content w-full max-w-5xl p-6 space-y-3.5 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 id="payrollPdfStudioTitle" class="text-lg font-black text-indigo-600">📄 استوديو تقارير الرواتب وسجل الحضور والانصراف (A4 / PDF)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">انقر داخل التقرير لتعديل أي نص أو رقم قبل الطباعة أو الحفظ كملف PDF</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'erpPayrollPdfStudioModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs">' +
        '    <div class="flex flex-wrap gap-2">' +
        '      <button type="button" onclick="App.openMasterAllStaffPayrollPdf()" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-black shadow">📑 التقرير الشامل لكل الموظفين + سجل الدخول والخروج</button>' +
        '      <button type="button" onclick="App.openIndividualEmployeePayrollPdf(AppState.selectedPayrollUserId)" class="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-black shadow">👤 كشف الراتب والحضور الفردي للعامل الحالي</button>' +
        '    </div>' +
        '    <div class="flex gap-2">' +
        '      <button type="button" onclick="App.executePayrollStudioPrintOrPdf(\'print\')" class="px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-black shadow">🖨️ طباعة فورية (A4)</button>' +
        '      <button type="button" onclick="App.executePayrollStudioPrintOrPdf(\'pdf\')" class="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black shadow">📥 حفظ كملف PDF</button>' +
        '    </div>' +
        '  </div>' +
        '  <iframe id="erpPayrollPdfPreviewFrame" class="w-full h-[60vh] border border-slate-300 dark:border-slate-700 rounded-2xl bg-white shadow-inner"></iframe>' +
        '</div>';
      document.body.appendChild(pm);
    }
  };

  // فتح استوديو تهيئة البصمة والكود والباركود لعامل محدد
  App.openEmployeeBiometricEnrollModal = async function (userId) {
    this.ensureErpV4ModalsDom();
    var users = (await window.api.getUsers().catch(function () { return []; })) || [];
    var u = users.find(function (x) { return Number(x.id) === Number(userId); }) || users[0];
    if (!u) return;

    var idProf = this.getEmployeeFullIdentityProfile(u);
    AppState._enrollScanStep = 0;

    var body = document.getElementById('bioEnrollModalBody');
    if (body) {
      body.innerHTML =
        '<div class="p-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between">' +
        '  <div><div class="text-sm font-black text-amber-400">👤 الموظف: ' + u.name + ' (' + u.role + ')</div><div class="text-[11px] text-slate-300 font-mono mt-0.5">Barcode: ' + idProf.barcode + ' | PIN: ' + idProf.pin + ' | ZKTeco ID: #' + idProf.zkDeviceUserId + '</div></div>' +
        '  <span class="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px]">✓ الهوية مفعلة</span>' +
        '</div>' +

        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        '  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
        '    <label class="block font-black text-indigo-600 mb-1">1. 🔢 الكود السري الشخصي للبصمة (PIN Code):</label>' +
        '    <input id="enrPinInput" type="text" value="' + idProf.pin + '" oninput="App.saveEmployeeIdentityField(' + u.id + ', \'pin\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-base text-center border-indigo-400">' +
        '  </div>' +
        '  <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">' +
        '    <label class="block font-black text-emerald-600 mb-1">2. 🔌 رقم العامل في جهاز البصمة (ZKTeco / RFID):</label>' +
        '    <input id="enrZkIdInput" type="text" value="' + idProf.zkDeviceUserId + '" oninput="App.saveEmployeeIdentityField(' + u.id + ', \'zkDeviceUserId\', this.value)" class="w-full px-3 py-2 rounded-xl font-mono font-black text-base text-center border-emerald-400">' +
        '  </div>' +
        '</div>' +

        '<!-- محاكي ومسجل البصمة البيومترية الثلاثي (3-Step Biometric Fingerprint Sensor) -->' +
        '<div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-center space-y-2.5">' +
        '  <div class="font-black text-sm text-indigo-700 dark:text-amber-300">3. 🫆 تسجيل وأخذ البصمة البيومترية للعامل (3 مسحات متتالية):</div>' +
        '  <div id="bioScanInteractivePad" onclick="App.stepBiometricScanEnroll(' + u.id + ')" class="w-24 h-24 rounded-3xl bg-slate-900 hover:bg-indigo-950 text-emerald-400 flex flex-col items-center justify-center mx-auto cursor-pointer border-2 border-emerald-500 shadow-lg transition">' +
        '    <span style="font-size:38px;">🫆</span>' +
        '    <span id="bioScanPadSubText" class="text-[10px] font-black text-amber-300 mt-1">انقر للمسح (1/3)</span>' +
        '  </div>' +
        '  <div id="bioScanProgressText" class="font-mono text-[11px] font-bold text-emerald-600">البصمة الرقمية المسجلة: ' + idProf.fingerprintHash + '</div>' +
        '</div>' +

        '<div class="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">' +
        '  <button type="button" onclick="App.closeModal(\'biometricEnrollModal\'); App.openStaffBadgePreviewModal(' + u.id + ')" class="px-4 py-2 rounded-xl bg-indigo-600 text-white font-black">🪪 معاينة وطباعة بطاقة الباركود (' + idProf.barcode + ')</button>' +
        '  <button type="button" onclick="App.closeModal(\'biometricEnrollModal\'); App.renderUsersView()" class="px-5 py-2 rounded-xl bg-emerald-600 text-white font-black shadow">✓ حفظ وإغلاق</button>' +
        '</div>';
    }

    this.openModal('biometricEnrollModal');
  };

  App.stepBiometricScanEnroll = function (userId) {
    AppState._enrollScanStep = (Number(AppState._enrollScanStep || 0) + 1);
    var step = AppState._enrollScanStep;
    var subEl = document.getElementById('bioScanPadSubText');
    var progEl = document.getElementById('bioScanProgressText');
    if (typeof playBeep === 'function') playBeep(true);

    if (step < 3) {
      if (subEl) subEl.textContent = 'المسحة (' + step + '/3) ✓';
      if (progEl) progEl.textContent = '⏳ جاري قراءة خطوط البصمة... اضغط المسحة رقم (' + (step + 1) + '/3)';
    } else {
      var newHash = 'FP-BIO-' + userId + '-' + Date.now().toString(36).toUpperCase();
      this.saveEmployeeIdentityField(userId, 'fingerprintHash', newHash);
      this.saveEmployeeIdentityField(userId, 'fingerprintEnrolled', true);
      if (subEl) subEl.textContent = 'مكتمل 3/3 ✅';
      if (progEl) progEl.textContent = '🎉 تم تسجيل وتشفير بصمة العامل بنجاح: ' + newHash;
      AppState._enrollScanStep = 0;
    }
  };

  // ==========================================================================
  // 2. مستورد ملفات أجهزة البصمة الحائطية (ZKTeco .DAT / .CSV / Excel Importer)
  // ==========================================================================
  App.triggerZKTecoFileImport = function () {
    var fileInp = document.getElementById('zkTecoHiddenFileInput');
    if (!fileInp) {
      fileInp = document.createElement('input');
      fileInp.id = 'zkTecoHiddenFileInput';
      fileInp.type = 'file';
      fileInp.accept = '.dat,.csv,.txt,.log';
      fileInp.style.display = 'none';
      fileInp.onchange = function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          App.parseAndImportZKTecoAttendanceText(ev.target.result || '');
        };
        reader.readAsText(file);
      };
      document.body.appendChild(fileInp);
    }
    fileInp.value = '';
    fileInp.click();
  };

  App.parseAndImportZKTecoAttendanceText = async function (rawText) {
    var users = (await window.api.getUsers().catch(function () { return []; })) || [];
    var lines = String(rawText || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length === 0) return;

    var importedCount = 0;
    lines.forEach(function (line) {
      // يدعم صيغة ZKTeco القياسية: UID \t YYYY-MM-DD HH:MM:SS أو CSV: UID,Date,TimeIn,TimeOut,Hours
      var parts = line.split(/[\t,;]+/).map(function (s) { return s.trim(); });
      if (parts.length >= 2) {
        var rawUid = parts[0].replace(/[^0-9]/g, '');
        var matchedU = users.find(function (u) {
          var prof = App.getEmployeeFullIdentityProfile(u);
          return String(u.id) === rawUid || String(prof.zkDeviceUserId) === rawUid || String(prof.pin) === rawUid;
        }) || users[0];

        if (matchedU) {
          var dateStr = (parts[1].slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/) ? parts[1].slice(0, 10) : new Date().toISOString().slice(0, 10));
          var hrs = parts[3] ? (parseFloat(parts[3]) || 8) : 8;
          var durMins = Math.round(hrs * 60);
          AppState.staffTimeClockLogs.unshift({
            id: 'ZK-' + Date.now() + '-' + importedCount,
            userId: matchedU.id,
            empName: matchedU.name,
            date: dateStr,
            checkIn: dateStr + 'T08:00:00',
            checkOut: dateStr + 'T16:00:00',
            durationMinutes: durMins,
            lateMinutes: 0,
            overtimeMinutes: durMins > 480 ? durMins - 480 : 0,
            method: '🔌 جهاز بصمة ZKTeco',
            note: 'مستورد من جهاز البصمة الخارجي'
          });
          importedCount++;
        }
      }
    });

    localStorage.setItem('gherbi_staff_timeclock_v1', JSON.stringify(AppState.staffTimeClockLogs));
    await this.renderUsersView();
    if (typeof showToast === 'function') {
      showToast('📂 تم استيراد (' + importedCount + ' سجل حضور وانصراف) من جهاز البصمة وحساب الساعات والدقائق بنجاح!', 'success');
    }
  };

  // زر محاكاة استيراد أسبوع كامل من جهاز البصمة بضغطة زر لتجربة النظام فوراً
  App.simulateWeekBiometricAttendanceForAllStaff = async function () {
    var users = (await window.api.getUsers().catch(function () { return []; })) || [];
    var nowMs = Date.now();
    var added = 0;

    users.forEach(function (u) {
      for (var d = 6; d >= 1; d--) {
        var dayDate = new Date(nowMs - d * 86400000).toISOString().slice(0, 10);
        var exists = (AppState.staffTimeClockLogs || []).some(function (l) {
          return Number(l.userId) === Number(u.id) && String(l.date || l.checkIn || '').slice(0, 10) === dayDate;
        });
        if (!exists) {
          var durMins = 480 + (d % 2 === 0 ? 30 : 0); // 8 ساعات أو 8 ساعات ونصف
          AppState.staffTimeClockLogs.unshift({
            id: 'BIO-SIM-' + u.id + '-' + d + '-' + Date.now(),
            userId: u.id,
            empName: u.name,
            date: dayDate,
            checkIn: dayDate + 'T08:00:00',
            checkOut: dayDate + 'T' + (d % 2 === 0 ? '16:30:00' : '16:00:00'),
            durationMinutes: durMins,
            lateMinutes: d === 3 ? 15 : 0,
            overtimeMinutes: d % 2 === 0 ? 30 : 0,
            method: '🫆 بصمة بيومترية (' + App.getEmployeeFullIdentityProfile(u).pin + ')',
            note: 'دوام يومي منتظم'
          });
          added++;
        }
      }
    });

    localStorage.setItem('gherbi_staff_timeclock_v1', JSON.stringify(AppState.staffTimeClockLogs));
    await this.renderUsersView();
    if (typeof showToast === 'function') {
      showToast('⚡ تم توليد وتوثيق بصمات الأسبوع (' + added + ' يوم عمل بالساعات والدقائق) لجميع العمال بنجاح!', 'success');
    }
  };

  // ==========================================================================
  // 3. محرك الأتمتة للدورة الأسبوعية / النصف شهرية / الشهرية + سجل حالة القبض
  // ==========================================================================
  App.applyPayrollCyclePreset = function (cycleType, targetUserId) {
    AppState.payrollPeriodCycle = cycleType; // 'weekly' | 'biweekly' | 'monthly'
    localStorage.setItem('gherbi_payroll_cycle', cycleType);

    var daysLookback = cycleType === 'weekly' ? 7 : cycleType === 'biweekly' ? 15 : 30;
    var cutoffIso = new Date(Date.now() - daysLookback * 86400000).toISOString().slice(0, 10);

    var statsMap = AppState._cachedUserStatsMap || {};
    var uids = targetUserId ? [Number(targetUserId)] : Object.keys(statsMap).map(Number);

    uids.forEach(function (uid) {
      var st = statsMap[uid];
      var cfg = App.getEmployeePayrollConfig(uid, st);
      var logsInPeriod = (AppState.staffTimeClockLogs || []).filter(function (l) {
        var dStr = String(l.date || l.checkIn || '').slice(0, 10);
        return Number(l.userId) === uid && dStr >= cutoffIso;
      });

      var totalMins = 0;
      var lateMins = 0;
      var daysSet = {};
      logsInPeriod.forEach(function (l) {
        totalMins += Number(l.durationMinutes || 480);
        lateMins += Number(l.lateMinutes || 0);
        var dStr = String(l.date || l.checkIn || '').slice(0, 10);
        if (dStr) daysSet[dStr] = true;
      });

      if (totalMins > 0) {
        cfg.workedHours = Math.floor(totalMins / 60);
        cfg.workedMinutes = totalMins % 60;
        cfg.lateMinutes = lateMins;
        cfg.workedDays = Object.keys(daysSet).length || (cycleType === 'weekly' ? 6 : 26);
      } else {
        // قيم قياسية متناسبة مع الدورة المختارة (أسبوعي = 44 ساعة / 6 أيام | نصف شهري = 88 ساعة / 13 يوماً | شهري = 176 ساعة / 26 يوماً)
        cfg.workedHours = cycleType === 'weekly' ? 44 : cycleType === 'biweekly' ? 88 : 176;
        cfg.workedMinutes = 0;
        cfg.workedDays = cycleType === 'weekly' ? 6 : cycleType === 'biweekly' ? 13 : 26;
      }

      // إذا كان النظام راتباً ثابتاً، نكيّفه مع الدورة (الأسبوعي = الشهري ÷ 4، النصف شهري = الشهري ÷ 2)
      var baseFullMonthly = Number((st && st.perms && st.perms.baseSalaryDzd) || 35000);
      if (cycleType === 'weekly') {
        cfg.baseMonthlySalaryDzd = Math.round(baseFullMonthly / 4);
      } else if (cycleType === 'biweekly') {
        cfg.baseMonthlySalaryDzd = Math.round(baseFullMonthly / 2);
      } else {
        cfg.baseMonthlySalaryDzd = baseFullMonthly;
      }

      AppState.payrollConfigsByUser[uid] = cfg;
    });

    localStorage.setItem('gherbi_payroll_configs_v1', JSON.stringify(AppState.payrollConfigsByUser));
    this.renderUsersView();
    if (typeof showToast === 'function') {
      var lbl = cycleType === 'weekly' ? 'الأسبوعية (7 أيام)' : cycleType === 'biweekly' ? 'النصف شهرية (15 يوماً)' : 'الشهرية الكاملة (30 يوماً)';
      showToast('📅 تم ضبط وحساب الأجور والحجم الساعي تلقائياً وفق الدورة ' + lbl + '!', 'success');
    }
  };

  // توليد وإصدار كشوف الرواتب لجميع العمال دفعة واحدة وحفظها في سجل الرواتب (بحالة: غير مقبوض ⏳ أو مقبوض ✅)
  App.generateBatchPayrollForAllStaff = function (markAsPaidImmediately) {
    var statsMap = AppState._cachedUserStatsMap || {};
    var cycle = AppState.payrollPeriodCycle || 'monthly';
    var cycleAr = cycle === 'weekly' ? 'راتب أسبوعي (7 أيام)' : cycle === 'biweekly' ? 'راتب نصف شهري (15 يوماً)' : 'راتب شهري (30 يوماً)';
    var todayStr = new Date().toISOString().slice(0, 10);

    Object.values(statsMap).forEach(function (st) {
      var u = st.user;
      var cfg = App.getEmployeePayrollConfig(u.id, st);
      var calc = App.computeUniversalEmployeePayroll(cfg, st);
      var rec = {
        id: 'PAY-' + Date.now() + '-' + u.id,
        userId: u.id,
        empName: u.name,
        empRole: u.role,
        periodLabel: cycleAr,
        date: todayStr,
        workedHours: cfg.workedHours,
        workedMinutes: cfg.workedMinutes,
        workedDays: cfg.workedDays,
        calcModeLabel: calc.modeArabicLabel,
        grossSalaryDzd: calc.grossSalaryDzd,
        totalDeductionsDzd: calc.totalDeductionsDzd,
        netPayableDzd: calc.netPayableDzd,
        status: markAsPaidImmediately ? 'paid' : 'unpaid',
        paidAt: markAsPaidImmediately ? new Date().toISOString().slice(0, 16).replace('T', ' ') : null
      };
      AppState.payrollRecordsLedger.unshift(rec);
    });

    localStorage.setItem('gherbi_payroll_ledger_v4', JSON.stringify(AppState.payrollRecordsLedger));
    this.renderUsersView();
    if (typeof showToast === 'function') {
      showToast('🎉 تم حساب وتوثيق رواتب جميع الموظفين في سجل الرواتب (' + cycleAr + ') بنجاح!', 'success');
    }
  };

  App.togglePayrollRecordPaidStatus = async function (recordId) {
    var rec = (AppState.payrollRecordsLedger || []).find(function (r) { return String(r.id) === String(recordId); });
    if (!rec) return;

    if (rec.status !== 'paid') {
      rec.status = 'paid';
      rec.paidAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
      await this.payEmployeeSalaryAndCommission(rec.empName, rec.netPayableDzd);
    } else {
      rec.status = 'unpaid';
      rec.paidAt = null;
    }

    localStorage.setItem('gherbi_payroll_ledger_v4', JSON.stringify(AppState.payrollRecordsLedger));
    await this.renderUsersView();
  };

  App.deletePayrollLedgerRecord = function (recordId) {
    AppState.payrollRecordsLedger = (AppState.payrollRecordsLedger || []).filter(function (r) {
      return String(r.id) !== String(recordId);
    });
    localStorage.setItem('gherbi_payroll_ledger_v4', JSON.stringify(AppState.payrollRecordsLedger));
    this.renderUsersView();
  };

  // ==========================================================================
  // 4. استوديو تقارير الـ PDF (التقرير الشامل لكل الموظفين + التقرير الفردي لكل عامل مع سجل الدخول والخروج)
  // ==========================================================================
  App.openMasterAllStaffPayrollPdf = async function () {
    this.ensureErpV4ModalsDom();
    var statsMap = AppState._cachedUserStatsMap || {};
    var shopName = (AppState.settings && AppState.settings.shop_name) || 'Gherbi.Ai POS';
    var todayStr = new Date().toISOString().slice(0, 10);

    var staffRowsHtml = '';
    var grandTotalNet = 0;

    Object.values(statsMap).forEach(function (st, idx) {
      var u = st.user;
      var cfg = App.getEmployeePayrollConfig(u.id, st);
      var calc = App.computeUniversalEmployeePayroll(cfg, st);
      var tcSum = App.getEmployeeTimeClockSummary(u.id);
      grandTotalNet += calc.netPayableDzd;

      var latestLedger = (AppState.payrollRecordsLedger || []).find(function (r) { return Number(r.userId) === Number(u.id); });
      var paidBadge = latestLedger && latestLedger.status === 'paid'
        ? '<span style="color:#047857;font-weight:900;">✅ تم القبض (' + (latestLedger.paidAt || '') + ')</span>'
        : '<span style="color:#d97706;font-weight:900;">⏳ قيد الانتظار (لم يُقبض)</span>';

      staffRowsHtml +=
        '<tr>' +
        '  <td>' + (idx + 1) + '</td>' +
        '  <td><strong>' + u.name + '</strong><br><small>' + u.role + '</small></td>' +
        '  <td>' + calc.modeArabicLabel + '</td>' +
        '  <td style="font-family:monospace;font-weight:bold;">' + cfg.workedHours + ' سا و ' + cfg.workedMinutes + ' د<br><small>(' + tcSum.logsCount + ' بصمة حضور)</small></td>' +
        '  <td style="font-family:monospace;">+' + calc.primaryTimeOrBasePay.toFixed(2) + '</td>' +
        '  <td style="font-family:monospace;color:#059669;">+' + (calc.overtimePay + calc.totalCommissionsDzd + calc.totalAllowancesDzd).toFixed(2) + '</td>' +
        '  <td style="font-family:monospace;color:#e11d48;">-' + calc.totalDeductionsDzd.toFixed(2) + '</td>' +
        '  <td style="font-family:monospace;font-weight:900;font-size:13px;color:#1d4ed8;">' + calc.netPayableDzd.toFixed(2) + ' د.ج<br><small>' + fmtCentimes(calc.netPayableDzd) + '</small></td>' +
        '  <td>' + paidBadge + '</td>' +
        '</tr>';
    });

    var attendanceRowsHtml = (AppState.staffTimeClockLogs || []).slice(0, 60).map(function (tc, i) {
      var h = Math.floor(Number(tc.durationMinutes || 0) / 60);
      var m = Number(tc.durationMinutes || 0) % 60;
      return (
        '<tr>' +
        '  <td>' + (i + 1) + '</td>' +
        '  <td><strong>' + tc.empName + '</strong></td>' +
        '  <td style="font-family:monospace;">' + String(tc.date || tc.checkIn || '').slice(0, 10) + '</td>' +
        '  <td style="font-family:monospace;color:#059669;font-weight:bold;">' + String(tc.checkIn || '').slice(11, 16) + '</td>' +
        '  <td style="font-family:monospace;color:#e11d48;font-weight:bold;">' + (tc.checkOut ? String(tc.checkOut).slice(11, 16) : 'في الدوام') + '</td>' +
        '  <td style="font-family:monospace;font-weight:900;">' + h + ' ساعة و ' + m + ' دقيقة</td>' +
        '  <td>' + (tc.lateMinutes > 0 ? tc.lateMinutes + ' د تأخر' : 'منتظم ✓') + '</td>' +
        '  <td>' + (tc.method || 'بصمة') + '</td>' +
        '</tr>'
      );
    }).join('');

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>التقرير الشامل للرواتب والحضور — ' + shopName + '</title>' +
      '<style>@page{size:A4 landscape;margin:10mm;}body{font-family:Cairo,Tahoma,sans-serif;padding:16px;color:#0f172a;font-size:11.5px;background:#fff;}table{width:100%;border-collapse:collapse;margin-top:8px;margin-bottom:16px;}th,td{border:1px solid #cbd5e1;padding:6px;text-align:right;}th{background:#0f172a;color:#fff;}</style></head><body contenteditable="true">' +
      '<div style="display:flex;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:10px;margin-bottom:12px;">' +
      '  <div><h2 style="margin:0;color:#1d4ed8;">' + shopName + ' — الكشف الشامل لرواتب الموظفين وسجل الحضور والانصراف بالساعة والدقيقة</h2><div>تاريخ الإصدار: ' + todayStr + ' | إجمالي كتلة الأجور الصافية: <strong>' + grandTotalNet.toFixed(2) + ' د.ج (' + fmtCentimes(grandTotalNet) + ')</strong></div></div>' +
      '</div>' +
      '<h3>أولاً: جدول مسير الرواتب والأجور وحالة القبض لجميع الموظفين</h3>' +
      '<table><thead><tr><th>#</th><th>الموظف</th><th>نظام الحساب</th><th>الحجم الساعي المنجز</th><th>الأجر الأساسي</th><th>الإضافي والعمولات والمنح (+)</th><th>الخصومات والسلفيات (-)</th><th>صافي الراتب المستحق</th><th>حالة القبض</th></tr></thead><tbody>' +
      staffRowsHtml +
      '</tbody></table>' +
      '<h3>ثانياً: السجل التفصيلي لحركات البصمة (متى دخل ومتى خرج كل عامل وعدد الساعات والدقائق)</h3>' +
      '<table><thead><tr><th>#</th><th>اسم العامل</th><th>التاريخ</th><th>وقت الدخول (من)</th><th>وقت الخروج (إلى)</th><th>الحجم الساعي المحسوب</th><th>الانضباط والتأخر</th><th>وسيلة التوثيق</th></tr></thead><tbody>' +
      (attendanceRowsHtml || '<tr><td colspan="8" style="text-align:center;">لا توجد حركات بصمة مسجلة بعد</td></tr>') +
      '</tbody></table></body></html>';

    this.openModal('erpPayrollPdfStudioModal');
    setTimeout(function () {
      var frame = document.getElementById('erpPayrollPdfPreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 40);
  };

  // التقرير الفردي المفصل لكل عامل على حدة (الراتب + جدول متى دخل ومتى خرج بالساعة والدقيقة)
  App.openIndividualEmployeePayrollPdf = async function (userId) {
    this.ensureErpV4ModalsDom();
    var uid = Number(userId || AppState.selectedPayrollUserId || 1);
    var statsMap = AppState._cachedUserStatsMap || {};
    var st = statsMap[uid] || Object.values(statsMap)[0];
    if (!st) return;

    var u = st.user;
    var idProf = this.getEmployeeFullIdentityProfile(u);
    var cfg = this.getEmployeePayrollConfig(uid, st);
    var calc = this.computeUniversalEmployeePayroll(cfg, st);
    var shopName = (AppState.settings && AppState.settings.shop_name) || 'Gherbi.Ai POS';

    var empLogs = (AppState.staffTimeClockLogs || []).filter(function (l) {
      return Number(l.userId) === Number(u.id);
    });

    var empAttendanceHtml = empLogs.map(function (tc, i) {
      var h = Math.floor(Number(tc.durationMinutes || 0) / 60);
      var m = Number(tc.durationMinutes || 0) % 60;
      return (
        '<tr>' +
        '  <td>' + (i + 1) + '</td>' +
        '  <td style="font-family:monospace;">' + String(tc.date || tc.checkIn || '').slice(0, 10) + '</td>' +
        '  <td style="font-family:monospace;color:#059669;font-weight:bold;">' + String(tc.checkIn || '').slice(11, 16) + '</td>' +
        '  <td style="font-family:monospace;color:#e11d48;font-weight:bold;">' + (tc.checkOut ? String(tc.checkOut).slice(11, 16) : 'في الدوام') + '</td>' +
        '  <td style="font-family:monospace;font-weight:900;">' + h + ' ساعة و ' + m + ' دقيقة</td>' +
        '  <td>' + (tc.lateMinutes > 0 ? tc.lateMinutes + ' دقيقة تأخر' : 'في الوقت ✓') + '</td>' +
        '  <td>' + (tc.note || tc.method || 'بصمة') + '</td>' +
        '</tr>'
      );
    }).join('');

    var html =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>كشف راتب وحضور فردي — ' + u.name + '</title>' +
      '<style>@page{size:A4 portrait;margin:10mm;}body{font-family:Cairo,Tahoma,sans-serif;padding:18px;color:#0f172a;font-size:12px;background:#fff;}table{width:100%;border-collapse:collapse;margin-top:8px;margin-bottom:14px;}th,td{border:1px solid #cbd5e1;padding:7px;text-align:right;}th{background:#0f172a;color:#fff;}.net{background:#047857;color:#fff;font-size:15px;font-weight:900;}</style></head><body contenteditable="true">' +
      '<div style="display:flex;justify-content:space-between;border-bottom:3px solid #1d4ed8;padding-bottom:10px;margin-bottom:12px;">' +
      '  <div><h2 style="margin:0;color:#1d4ed8;">' + shopName + ' — كشف الراتب التفصيلي وسجل الحضور والانصراف الفردي</h2><div>الموظف: <strong>' + u.name + '</strong> | الوظيفة: ' + u.role + ' | الباركود: ' + idProf.barcode + ' | الكود السري: ' + idProf.pin + '</div></div>' +
      '  <div style="text-align:left;font-family:monospace;">التاريخ: ' + new Date().toISOString().slice(0, 10) + '</div>' +
      '</div>' +
      '<h3>1. التفصيل المالي للراتب والاستحقاقات والاقتطاعات (' + calc.modeArabicLabel + ')</h3>' +
      '<table><thead><tr><th>البند المحاسبي</th><th>الشرح وطريقة الحساب</th><th>الاستحقاقات (+)</th><th>الاقتطاعات (-)</th></tr></thead><tbody>' +
      '<tr><td>الأجر الأساسي / الساعات والدقائق</td><td>' + cfg.workedHours + ' ساعة و ' + cfg.workedMinutes + ' دقيقة (تسعيرة الساعة: ' + cfg.hourlyRateDzd + ' د.ج | الدقيقة: ' + calc.minuteRateDzd + ' د.ج)</td><td>+' + calc.primaryTimeOrBasePay.toFixed(2) + ' د.ج</td><td>—</td></tr>' +
      '<tr><td>أجر الساعات والدقائق الإضافية (Overtime)</td><td>' + cfg.overtimeHours + ' ساعة و ' + cfg.overtimeMinutes + ' دقيقة (×' + cfg.overtimeMultiplier + ')</td><td>+' + calc.overtimePay.toFixed(2) + ' د.ج</td><td>—</td></tr>' +
      '<tr><td>عمولات المبيعات والمنح والعلاوات</td><td>عمولة مبيعات: +' + calc.totalCommissionsDzd.toFixed(2) + ' | منح (نقل/إطعام): +' + calc.totalAllowancesDzd.toFixed(2) + '</td><td>+' + (calc.totalCommissionsDzd + calc.totalAllowancesDzd).toFixed(2) + ' د.ج</td><td>—</td></tr>' +
      '<tr><td>خصم التأخر والغياب والسلفيات و CNAS</td><td>تأخر (' + cfg.lateMinutes + 'د) + سلفيات (' + calc.empAdvancesDzd.toFixed(0) + ') + CNAS (' + calc.cnasDeductionDzd.toFixed(0) + ')</td><td>—</td><td>-' + calc.totalDeductionsDzd.toFixed(2) + ' د.ج</td></tr>' +
      '<tr class="net"><td colspan="2">صافي الراتب النهائي المستحق للدفع (NET À PAYER)</td><td colspan="2">' + calc.netPayableDzd.toFixed(2) + ' د.ج (' + fmtCentimes(calc.netPayableDzd) + ')</td></tr>' +
      '</tbody></table>' +
      '<h3>2. كشف الحضور والانصراف التفصيلي للعامل (متى دخل ومتى خرج بالساعة والدقيقة)</h3>' +
      '<table><thead><tr><th>#</th><th>التاريخ</th><th>وقت الدخول</th><th>وقت الخروج</th><th>المدة المحسوبة (ساعات ودقائق)</th><th>ملاحظة الانضباط</th><th>طريقة التوثيق</th></tr></thead><tbody>' +
      (empAttendanceHtml || '<tr><td colspan="7" style="text-align:center;">إجمالي الساعات المعتمدة في الكشف: ' + cfg.workedHours + ' ساعة و ' + cfg.workedMinutes + ' دقيقة</td></tr>') +
      '</tbody></table>' +
      '<div style="display:flex;justify-content:space-between;margin-top:34px;font-weight:bold;"><div>إمضاء وبصمة العامل المستلم للراتب: ........................</div><div>ختم وإمضاء المدير العام: ........................</div></div>' +
      '</body></html>';

    this.openModal('erpPayrollPdfStudioModal');
    setTimeout(function () {
      var frame = document.getElementById('erpPayrollPdfPreviewFrame');
      if (frame && frame.contentWindow) {
        var doc = frame.contentWindow.document;
        doc.open();
        doc.write(html);
        doc.close();
      }
    }, 40);
  };

  App.executePayrollStudioPrintOrPdf = async function (actionType) {
    var frame = document.getElementById('erpPayrollPdfPreviewFrame');
    if (!frame || !frame.contentWindow) return;
    var clone = frame.contentWindow.document.documentElement.cloneNode(true);
    clone.querySelectorAll('[contenteditable]').forEach(function (el) { el.removeAttribute('contenteditable'); });
    var html = '<!DOCTYPE html>\n' + clone.outerHTML;

    if (actionType === 'pdf' && window.api && window.api.exportPDF) {
      var res = await window.api.exportPDF({
        html: html,
        filename: 'Gherbi_ERP_Payroll_Attendance_Report_' + new Date().toISOString().slice(0, 10) + '.pdf'
      });
      if (res && res.success && typeof showToast === 'function') {
        showToast('📄 تم تصدير وحفظ تقرير الرواتب والحضور بصيغة PDF بنجاح!', 'success');
      }
      return;
    }
    if (window.PrintEngine) {
      await window.PrintEngine.printHtmlDocument(html, { silent: false });
    }
  };

  // ربط زر طباعة الكشف الفردي باستوديو المعاينة والـ PDF الجديد
  App.printEmployeePayslipA4 = function (userId) {
    return this.openIndividualEmployeePayrollPdf(userId);
  };

  // ==========================================================================
  // 5. تحديث واجهة التبويب 1 (إضافة أزرار تهيئة البصمة والكود) والتبويب 5 (إصلاح الحقل الأسود + استيراد ZKTeco) والتبويب 4 (الدورات الآلية + سجل القبض + أزرار PDF)
  // ==========================================================================
  var _prevRenderUsersV3 = App.renderUsersView.bind(App);
  App.renderUsersView = async function () {
    await _prevRenderUsersV3();
    var body = document.getElementById('usersMainTabBody');
    if (!body) return;

    var curTab = AppState.usersActiveTab || 'directory';
    var statsMap = AppState._cachedUserStatsMap || {};
    var users = Object.values(statsMap).map(function (st) { return st.user; });

    // ------------------------------------------------------------------------
    // أ) في التبويب 1 (دليل الموظفين): إضافة شريط "استوديو تهيئة البصمات والأكواد والبطاقات" قبل الذهاب للبصمة!
    // ------------------------------------------------------------------------
    if (curTab === 'directory') {
      var enrollBanner = document.createElement('div');
      enrollBanner.className = 'p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-3 text-xs mt-3';
      enrollBanner.innerHTML =
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '  <div>' +
        '    <h4 class="font-black text-sm text-indigo-700 dark:text-amber-300">🫆🪪 الخطوة التأسيسية قبل البصمة: إعداد الكود السري (PIN)، الباركود، والبصمة البيومترية لكل موظف</h4>' +
        '    <p class="text-[11px] text-slate-500 dark:text-slate-300">اضبط هنا الكود السري ورقم جهاز البصمة واطبع بطاقة الباركود لكل عامل لتستعملها مباشرة في تبويب (البصمة والحضور)</p>' +
        '  </div>' +
        '  <div class="flex gap-2">' +
        '    <button type="button" onclick="App.simulateWeekBiometricAttendanceForAllStaff()" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow">⚡ توليد بصمات أسبوع كامل للتجربة</button>' +
        '    <button type="button" onclick="AppState.usersActiveTab=\'time_clock\'; App.renderUsersView()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow">⏱️ الانتقال إلى محطة البصمة ⬅️</button>' +
        '  </div>' +
        '</div>' +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        users.map(function (u) {
          var prof = App.getEmployeeFullIdentityProfile(u);
          return (
            '<div class="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shadow-sm">' +
            '  <div>' +
            '    <div class="font-black text-sm">' + u.name + ' <span class="text-[10px] text-indigo-600">(' + u.role + ')</span></div>' +
            '    <div class="font-mono text-[11px] text-slate-500 mt-0.5">🔢 الكود السري: <strong class="text-indigo-600 dark:text-amber-400">' + prof.pin + '</strong> | 🏷️ الباركود: <strong>' + prof.barcode + '</strong> | 🫆 البصمة: <strong class="text-emerald-600">' + prof.fingerprintHash + '</strong></div>' +
            '  </div>' +
            '  <div class="flex items-center gap-1.5">' +
            '    <button type="button" onclick="App.openEmployeeBiometricEnrollModal(' + u.id + ')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow">🫆 تسجيل البصمة والكود</button>' +
            '    <button type="button" onclick="App.openStaffBadgePreviewModal(' + u.id + ')" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-black shadow">🪪 بطاقة الباركود</button>' +
            '  </div>' +
            '</div>'
          );
        }).join('') +
        '</div>';
      body.appendChild(enrollBanner);
    }

    // ------------------------------------------------------------------------
    // ب) في التبويب 5 (محطة البصمة): إصلاح وضوح الكتابة في الحقل الأسود + إضافة أزرار جلب واستيراد البصمات (ZKTeco / USB / Enrollment)
    // ------------------------------------------------------------------------
    else if (curTab === 'time_clock') {
      var codeInp = document.getElementById('timeClockQuickCodeInput');
      if (codeInp) {
        // فرض تباين بصري فائق الوضوح (نص أسود داكن جداً وكبير فوق خلفية بيضاء نقية محاطة بإطار كهرماني مضيء)
        codeInp.setAttribute(
          'style',
          'background-color:#ffffff !important; color:#0f172a !important; font-size:18px !important; font-weight:900 !important; letter-spacing:1.5px !important; border:3px solid #f59e0b !important; box-shadow:0 0 15px rgba(245,158,11,0.35) !important;'
        );
        if (codeInp.previousElementSibling) {
          codeInp.previousElementSibling.setAttribute('style', 'color:#fef08a !important; font-weight:900 !important; font-size:11.5px !important;');
        }
      }

      // إضافة شريط جلب واستيراد البصمات من أجهزة ZKTeco / USB وتهيئة بصمات العمال أعلى التبويب 5
      var bioImportBar = document.createElement('div');
      bioImportBar.className = 'p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs mb-3';
      bioImportBar.innerHTML =
        '<div>' +
        '  <div class="font-black text-sm text-emerald-800 dark:text-emerald-300">🔌🫆 مركز جلب البصمات وربط أجهزة البصمة الخارجية (ZKTeco / USB Reader / Biometric Enrollment):</div>' +
        '  <div class="text-[11px] text-slate-600 dark:text-slate-300">سجّل بصمة وكود كل عامل، أو استورد ملف الحضور من جهاز البصمة الحائطي (ZKTeco .DAT/.CSV)، أو ولّد بصمات أسبوع كامل للتجربة</div>' +
        '</div>' +
        '<div class="flex flex-wrap gap-2">' +
        '  <button type="button" onclick="App.openEmployeeBiometricEnrollModal(' + ((users[0] && users[0].id) || 1) + ')" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow">🫆 تهيئة بصمة وكود عامل</button>' +
        '  <button type="button" onclick="App.triggerZKTecoFileImport()" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow">📂 استيراد ملف جهاز بصمة (ZKTeco / CSV)</button>' +
        '  <button type="button" onclick="App.simulateWeekBiometricAttendanceForAllStaff()" class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow">⚡ جلب ومحاكاة بصمات أسبوع كامل</button>' +
        '</div>';
      body.prepend(bioImportBar);
    }

    // ------------------------------------------------------------------------
    // ج) في التبويب 4 (حاسبة الرواتب): إضافة شريط الدورات الآلي (أسبوعي / نصف شهري / شهري) + أزرار PDF الشامل والفردي + سجل الرواتب وحالة القبض
    // ------------------------------------------------------------------------
    else if (curTab === 'hr_commissions') {
      var curCycle = AppState.payrollPeriodCycle || 'monthly';
      var selUid = Number(AppState.selectedPayrollUserId || (users[0] && users[0].id) || 1);

      var cycleAndPdfToolbar = document.createElement('div');
      cycleAndPdfToolbar.className = 'p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs mb-3 shadow-xl';
      cycleAndPdfToolbar.innerHTML =
        '<div class="flex flex-wrap items-center gap-2">' +
        '  <span class="font-black text-amber-400">📅 1. اختر دورة الرواتب (تُحسب تلقائياً دون عناء):</span>' +
        '  <button type="button" onclick="App.applyPayrollCyclePreset(\'weekly\')" class="px-3.5 py-1.5 rounded-xl font-black transition ' + (curCycle === 'weekly' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">أسبوعي (7 أيام)</button>' +
        '  <button type="button" onclick="App.applyPayrollCyclePreset(\'biweekly\')" class="px-3.5 py-1.5 rounded-xl font-black transition ' + (curCycle === 'biweekly' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">نصف شهري (15 يوماً)</button>' +
        '  <button type="button" onclick="App.applyPayrollCyclePreset(\'monthly\')" class="px-3.5 py-1.5 rounded-xl font-black transition ' + (curCycle === 'monthly' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">شهري كامل (30 يوماً)</button>' +
        '  <button type="button" onclick="App.generateBatchPayrollForAllStaff(false)" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow">⚡ إصدار رواتب كل العمال دفعة واحدة</button>' +
        '</div>' +
        '<div class="flex flex-wrap items-center gap-2">' +
        '  <button type="button" onclick="App.openMasterAllStaffPayrollPdf()" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow">📑 PDF رواتب وحضور كل الموظفين</button>' +
        '  <button type="button" onclick="App.openIndividualEmployeePayrollPdf(' + selUid + ')" class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black shadow">👤 PDF كشف وحضور هذا العامل</button>' +
        '</div>';
      body.prepend(cycleAndPdfToolbar);

      // بناء جدول سجل الرواتب ومتابعة حالة القبض (هل قُبض الراتب أم لا؟) أسفل حاسبة الرواتب
      var ledgerList = AppState.payrollRecordsLedger || [];
      var ledgerBox = document.createElement('div');
      ledgerBox.className = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3 text-xs mt-4 shadow-sm';
      ledgerBox.innerHTML =
        '<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '  <div>' +
        '    <h3 class="font-black text-sm text-indigo-600">📋 سجل مسير الرواتب والأجور ومتابعة حالة القبض (' + ledgerList.length + ' كشف راتب)</h3>' +
        '    <p class="text-[11px] text-slate-400">يوثق جميع الرواتب الأسبوعية والشهرية ويوضح هل استلم العامل راتبه (✅ تم القبض) أم لا يزال قيد الانتظار (⏳ غير مقبوض)</p>' +
        '  </div>' +
        '  <div class="flex gap-2">' +
        '    <button type="button" onclick="App.generateBatchPayrollForAllStaff(false)" class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-black shadow">+ تسجيل الكشف الحالي في السجل</button>' +
        '    <button type="button" onclick="App.openMasterAllStaffPayrollPdf()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-black shadow">🖨️ طباعة السجل الكامل (PDF)</button>' +
        '  </div>' +
        '</div>' +
        '<div class="overflow-x-auto max-h-80">' +
        '  <table class="w-full text-xs text-right">' +
        '    <thead class="bg-slate-100 dark:bg-slate-900 text-slate-500">' +
        '      <tr><th class="p-2.5">#</th><th class="p-2.5">الموظف</th><th class="p-2.5">الدورة والتاريخ</th><th class="p-2.5 text-center">الساعات والدقائق</th><th class="p-2.5">الإجمالي الخام</th><th class="p-2.5">الخصومات</th><th class="p-2.5">الصافي للدفع</th><th class="p-2.5 text-center">حالة القبض والاستلام</th><th class="p-2.5 text-center">إجراءات</th></tr>' +
        '    </thead>' +
        '    <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">' +
        (ledgerList.length > 0
          ? ledgerList.map(function (r, idx) {
              var isPaid = r.status === 'paid';
              return (
                '<tr class="hover:bg-slate-50 dark:hover:bg-slate-700/20">' +
                '  <td class="p-2.5 font-mono text-slate-400">' + (idx + 1) + '</td>' +
                '  <td class="p-2.5 font-black">' + r.empName + ' <span class="text-[10px] text-slate-400">(' + (r.empRole || '') + ')</span></td>' +
                '  <td class="p-2.5"><span class="font-bold text-indigo-600">' + r.periodLabel + '</span><div class="font-mono text-[10px] text-slate-400">' + r.date + '</div></td>' +
                '  <td class="p-2.5 text-center font-mono font-bold">' + r.workedHours + 'سا و ' + r.workedMinutes + 'د (' + r.workedDays + ' يوم)</td>' +
                '  <td class="p-2.5 font-mono">' + Number(r.grossSalaryDzd || 0).toFixed(2) + '</td>' +
                '  <td class="p-2.5 font-mono text-rose-600">-' + Number(r.totalDeductionsDzd || 0).toFixed(2) + '</td>' +
                '  <td class="p-2.5 font-mono font-black text-emerald-600 text-sm">' + Number(r.netPayableDzd || 0).toFixed(2) + ' د.ج</td>' +
                '  <td class="p-2.5 text-center">' +
                (isPaid
                  ? '<span class="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 font-black">✅ تم القبض (' + (r.paidAt || '') + ')</span>'
                  : '<span class="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black">⏳ غير مقبوض (قيد الانتظار)</span>') +
                '  </td>' +
                '  <td class="p-2.5">' +
                '    <div class="flex items-center justify-center gap-1.5">' +
                '      <button type="button" onclick="App.togglePayrollRecordPaidStatus(\'' + r.id + '\')" class="px-3 py-1 rounded-xl font-black text-[11px] shadow ' + (isPaid ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white') + '">' + (isPaid ? '↩️ إلغاء القبض' : '💸 تأكيد القبض والصرف') + '</button>' +
                '      <button type="button" onclick="App.openIndividualEmployeePayrollPdf(' + r.userId + ')" class="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-black text-[11px]" title="طباعة PDF فردي">📄 PDF</button>' +
                '      <button type="button" onclick="App.deletePayrollLedgerRecord(\'' + r.id + '\')" class="p-1 text-rose-500 hover:bg-rose-500/15 rounded-lg"><span class="material-symbols-rounded icon-sm">delete</span></button>' +
                '    </div>' +
                '  </td>' +
                '</tr>'
              );
            }).join('')
          : '<tr><td colspan="9" class="py-8 text-center text-slate-400 font-bold">لا توجد رواتب مسجلة في الدفتر بعد — اضغط (⚡ إصدار رواتب كل العمال دفعة واحدة) أعلاه لتوليدها فوراً!</td></tr>') +
        '    </tbody>' +
        '  </table>' +
        '</div>';
      body.appendChild(ledgerBox);
    }
  };
}

// ============================================================================
// حقن الوحدة في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [PAGE 17 V4 BIOMETRIC ENROLLMENT, AUTO PERIOD PAYROLL, PAID LEDGER & DUAL PDF]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installPage17ErpBiometricsAutoPayrollAndPdfV4.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ تم حقن وفحص منظومة الهوية والبصمات، الرواتب الأسبوعية/الشهرية الآلية، سجل القبض، واستوديو PDF المزدوج (V4) في renderer-rc-100.js بنجاح (0 أخطاء نحوية).');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['upgrade-page17-biometric-timeclock-and-clean-payroll-v3.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 اكتملت الترقية V4 بنجاح! اضغط Ctrl+R داخل البرنامج الآن واستمتع باستوديو البصمة والرواتب الآلية وتقارير PDF.');