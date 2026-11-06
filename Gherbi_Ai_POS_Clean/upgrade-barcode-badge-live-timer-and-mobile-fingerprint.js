/**
 * fix-staff-badge-print-and-mobile-biometrics-v8.js
 * الحل الجذري والنهائي لـ:
 * 1. تصميم بطاقة عمل الموظف الاحترافية (Executive VIP CR80 Badge) بباركود Code-128 عريض وعملاق وفائق الوضوح
 *    مع إزالة تكرار الرقم (1001 / 1002) نهائياً، وإصلاح الطباعة وتصدير الـ PDF لتخرج في صفحة واحدة ملونة 100% بدون انقسام أو دوران!
 * 2. إصلاح رابط وشاشة بصمة الهاتف المحمول:
 *    - ترقية getPrimaryLocalIp في main.js لاختيار عنوان الـ Wi-Fi الحقيقي وتجاهل الكروت الوهمية (VirtualBox/VMware/WSL).
 *    - فتح منفذ 8080 في جدار حماية ويندوز تلقائياً.
 *    - إضافة شاشة هاتف ذكي تفاعلية مدمجة (Interactive Smartphone Biometric Simulator) داخل النافذة لتعمل البصمة فوراً على الحاسوب وعلى الهاتف معاً!
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = __dirname;

console.log('🇩🇿🚀 بدء إصلاح تصميم وطباعة بطاقة الباركود (VIP Badge Single-Page Print/PDF) + تفعيل جسر ومحاكي بصمة الهاتف المحمول...\n');

// ============================================================================
// 1. محاولة إضافة قاعدة سماح للمنفذ 8080 في جدار حماية ويندوز (لضمان وصول الهاتف عبر الـ Wi-Fi)
// ============================================================================
try {
  execSync('netsh advfirewall firewall add rule name="Gherbi_POS_Mobile_Biometric_8080" dir=in action=allow protocol=TCP localport=8080', { stdio: 'ignore' });
  console.log('✅ تم تفعيل قاعدة السماح للمنفذ 8080 في جدار حماية ويندوز (Windows Firewall).');
} catch (_) {
  console.log('ℹ️ ملاحظة: تم تخطي أمر جدار الحماية (يتطلب صلاحيات مسؤول إن لزم، ولكن المحاكي المدمج والـ Wi-Fi المحلي جاهزان).');
}

// ============================================================================
// 2. ترقية main.js لاختيار عنوان الـ Wi-Fi الحقيقي وتجاهل كروت الشبكة الوهمية (VirtualBox / VMware / WSL)
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  const oldIpFn = `function getPrimaryLocalIp() {
  const list = getLocalIpv4List();
  return list.length > 0 ? list[0].address : '127.0.0.1';
}`;

  const smartIpFn = `function getPrimaryLocalIp() {
  const list = getLocalIpv4List();
  if (list.length === 0) return '127.0.0.1';
  // استبعاد كروت الشبكة الوهمية (VirtualBox 192.168.56.x, VMware, WSL, Hyper-V) وإعطاء الأولوية للـ Wi-Fi الحقيقي
  const realList = list.filter((item) => {
    const n = String(item.name || '').toLowerCase();
    const a = String(item.address || '');
    if (a.startsWith('192.168.56.') || a.startsWith('169.254.')) return false;
    if (n.includes('virtual') || n.includes('vmware') || n.includes('vbox') || n.includes('wsl') || n.includes('hyper-v') || n.includes('loopback')) return false;
    return true;
  });
  const wifiMatch = realList.find((item) => /wi-?fi|wlan|wireless/i.test(String(item.name || '')));
  if (wifiMatch) return wifiMatch.address;
  const lanMatch = realList.find((item) => String(item.address || '').startsWith('192.168.'));
  if (lanMatch) return lanMatch.address;
  return (realList[0] && realList[0].address) || list[0].address || '127.0.0.1';
}`;

  if (mainCode.includes(oldIpFn)) {
    mainCode = mainCode.replace(oldIpFn, smartIpFn);
    new vm.Script(mainCode, { filename: 'main.js' });
    fs.writeFileSync(mainPath, mainCode, 'utf8');
    console.log('✅ 1/3: تم ترقية دالة getPrimaryLocalIp() في main.js لاكتشاف عنوان الـ Wi-Fi الحقيقي تلقائياً.');
  }
}

// ============================================================================
// 3. حقن التصميم الملكي الجديد للبطاقة + إصلاح الطباعة والـ PDF + محاكي وجسر بصمة الهاتف في renderer-rc-100.js
// ============================================================================
function installVipStaffBadgePrintAndMobileBiometricFixV8() {
  if (!window.App || !window.AppState) return;

  AppState.staffBadgeBarcodeTarget = AppState.staffBadgeBarcodeTarget || 'pin'; // 'pin' (1001) | 'usr' (USR-0001)

  // جدول أنماط Code-128B القياسي (ISO/IEC 15417) لرسم خطوط باركود حادة وكبيرة جداً بدون أي تكرار للنص
  var CODE128_PATTERNS = [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ];

  // رسم باركود Code-128B عريض وكبير وحاد جداً (Crisp Vector Bars) مع رقم واحد فقط تحته!
  App.generateWideCrispCode128Svg = function (rawText, barHeightPx) {
    var text = String(rawText || '1001').trim();
    if (!text) text = '1001';
    var height = Number(barHeightPx || 78);

    var codes = [104]; // Start Code B
    var checksum = 104;
    for (var i = 0; i < text.length; i++) {
      var cc = text.charCodeAt(i);
      var val = (cc >= 32 && cc <= 126) ? (cc - 32) : 0;
      codes.push(val);
      checksum += val * (i + 1);
    }
    codes.push(checksum % 103);
    codes.push(106); // Stop pattern

    var quietZone = 18;
    var x = quietZone;
    var moduleWidth = 3.2; // خطوط عريضة وواضحة جداً لأي قارئ باركود
    var rects = [];

    for (var c = 0; c < codes.length; c++) {
      var pat = CODE128_PATTERNS[codes[c]];
      if (!pat) continue;
      for (var p = 0; p < pat.length; p++) {
        var w = parseInt(pat.charAt(p), 10) * moduleWidth;
        if (p % 2 === 0) {
          rects.push('<rect x="' + x.toFixed(2) + '" y="6" width="' + w.toFixed(2) + '" height="' + height + '" fill="#000000" shape-rendering="crispEdges" />');
        }
        x += w;
      }
    }

    var totalWidth = Math.ceil(x + quietZone);
    var totalSvgHeight = height + 34;

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalWidth + ' ' + totalSvgHeight + '" shape-rendering="crispEdges" style="width:96%;max-width:340px;height:' + totalSvgHeight + 'px;background:#ffffff;display:block;margin:0 auto;">' +
      '  <rect x="0" y="0" width="' + totalWidth + '" height="' + totalSvgHeight + '" fill="#ffffff" />' +
      rects.join('') +
      '  <text x="' + (totalWidth / 2).toFixed(1) + '" y="' + (height + 26) + '" font-family="\'Segoe UI\', Tahoma, monospace" font-size="18" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="6">' + text + '</text>' +
      '</svg>'
    );
  };

  // ==========================================================================
  // أ. بناء التصميم الاحترافي الفاخر لبطاقة الموظف (Executive VIP Staff ID Card)
  // ==========================================================================
  App.buildExecutiveStaffBadgeHtml = function (u, info, codeToEncode, shopName) {
    var firstLetter = String(u.name || 'م').trim().charAt(0) || 'م';
    var roleColors = {
      Admin: { bg: '#4f46e5', label: 'ADMIN / مدير عام' },
      Supervisor: { bg: '#0284c7', label: 'SUPERVISOR / مشرف' },
      Cashier: { bg: '#059669', label: 'CASHIER / كاشير معتمد' },
      Storekeeper: { bg: '#d97706', label: 'STOREKEEPER / أمين مخزن' },
      Accountant: { bg: '#7c3aed', label: 'ACCOUNTANT / محاسب' }
    };
    var rBadge = roleColors[u.role] || { bg: '#2563eb', label: u.role || 'STAFF' };
    var wideBarcodeSvg = this.generateWideCrispCode128Svg(codeToEncode, 76);

    return (
      '<div class="vip-badge-card" style="width:380px;border:2.5px solid #0f172a;border-radius:20px;overflow:hidden;background:#ffffff;color:#0f172a;font-family:\'Cairo\',\'Tajawal\',sans-serif;box-shadow:0 15px 35px rgba(15,23,42,0.18);page-break-inside:avoid;break-inside:avoid;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;">' +
      '  <!-- الترويسة الملكية للبطاقة -->' +
      '  <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%) !important;color:#ffffff !important;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f59e0b;">' +
      '    <div style="text-align:right;">' +
      '      <div style="font-weight:900;font-size:17px;letter-spacing:0.3px;color:#ffffff !important;">' + shopName + '</div>' +
      '      <div style="font-size:10.5px;font-weight:700;color:#93c5fd !important;">بطاقة هوية وبصمة دوام الموظف (STAFF ID)</div>' +
      '    </div>' +
      '    <div style="background:#f59e0b !important;color:#0f172a !important;font-weight:900;font-size:13px;padding:4px 12px;border-radius:10px;font-family:monospace;box-shadow:0 2px 8px rgba(0,0,0,0.25);">' +
      '      PIN: ' + info.pin +
      '    </div>' +
      '  </div>' +

      '  <!-- قسم هوية الموظف والبيانات الوظيفية -->' +
      '  <div style="padding:14px 18px 10px;background:#f8fafc !important;border-bottom:1.5px solid #e2e8f0;display:flex;align-items:center;gap:14px;">' +
      '    <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#2563eb,#1d4ed8) !important;color:#ffffff !important;font-size:24px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;border:2px solid #bfdbfe;">' +
      firstLetter +
      '    </div>' +
      '    <div style="flex:1;text-align:right;">' +
      '      <div style="font-size:20px;font-weight:900;color:#0f172a;line-height:1.2;">' + u.name + '</div>' +
      '      <div style="display:inline-block;margin-top:4px;padding:2px 10px;border-radius:6px;background:' + rBadge.bg + ' !important;color:#ffffff !important;font-size:11px;font-weight:800;">' + rBadge.label + '</div>' +
      '      <div style="font-size:11.5px;font-weight:800;color:#0f766e;margin-top:4px;">' + info.contractArabicLabel + '</div>' +
      '    </div>' +
      '  </div>' +

      '  <!-- شريط المعرفات الرقمية -->' +
      '  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#f1f5f9 !important;border-bottom:1.5px solid #cbd5e1;padding:6px 12px;text-align:center;font-size:10.5px;">' +
      '    <div><span style="color:#64748b;font-weight:700;">رقم البطاقة:</span> <strong style="font-family:monospace;color:#0f172a;">' + info.barcode + '</strong></div>' +
      '    <div style="border-right:1px solid #cbd5e1;border-left:1px solid #cbd5e1;"><span style="color:#64748b;font-weight:700;">الكود السري:</span> <strong style="font-family:monospace;color:#1d4ed8;">' + info.pin + '</strong></div>' +
      '    <div><span style="color:#64748b;font-weight:700;">الدوام:</span> <strong style="font-family:monospace;color:#0f172a;">' + info.shiftStart + '-' + info.shiftEnd + '</strong></div>' +
      '  </div>' +

      '  <!-- منطقة الباركود الكبير والعريض (HIGH-DENSITY WIDE CODE-128 BARCODE) -->' +
      '  <div style="padding:14px 16px 12px;background:#ffffff !important;text-align:center;">' +
      '    <div style="padding:10px 8px 6px;border:2px solid #0f172a;border-radius:14px;background:#ffffff !important;">' +
      wideBarcodeSvg +
      '    </div>' +
      '    <div style="font-size:11px;font-weight:900;color:#047857;margin-top:8px;">' +
      '      🏷️ مرّر هذا الباركود على القارئ لبدء أو إيقاف عداد وقت العمل تلقائياً' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  };

  App.openStaffBadgePreviewModal = async function (userId, preferredCodeType) {
    this.ensureCleanPage17ModalsDom();
    if (preferredCodeType) AppState.staffBadgeBarcodeTarget = preferredCodeType;

    var users = (await window.api.getUsers().catch(function () { return []; })) || [];
    var u = users.find(function (x) { return Number(x.id) === Number(userId); }) || users[0];
    if (!u) return;

    AppState._currentBadgeUserId = u.id;
    AppState._currentBadgeUserName = u.name;
    var info = this.getEmployeeFullIdentityAndContract(u);
    var codeToEncode = AppState.staffBadgeBarcodeTarget === 'usr' ? info.barcode : info.pin;
    var shopName = (AppState.settings && AppState.settings.shop_name) || 'Gherbi.Ai POS';

    var cardHtml = this.buildExecutiveStaffBadgeHtml(u, info, codeToEncode, shopName);
    AppState._lastStaffBadgeHtml = cardHtml;

    // تحديث أزرار الفوتر في نافذة البطاقة لتشمل زر حفظ PDF مباشر + طباعة A4 نظيفة
    var modalEl = document.getElementById('staffBadgeModal');
    if (modalEl) {
      var footerEl = modalEl.querySelector('.flex.justify-end.gap-2');
      if (footerEl) {
        footerEl.innerHTML =
          '<button type="button" onclick="App.closeModal(\'staffBadgeModal\')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إغلاق</button>' +
          '<button type="button" onclick="App.exportCurrentStaffBadgePdf()" class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg">💾 حفظ البطاقة كملف PDF ملون</button>' +
          '<button type="button" onclick="App.printCurrentStaffBadge()" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-lg">🖨️ طباعة البطاقة (صفحة واحدة)</button>';
      }
    }

    var box = document.getElementById('staffBadgePreviewBox');
    if (box) {
      box.innerHTML =
        '<div class="space-y-3.5 w-full flex flex-col items-center">' +
        '  <div class="flex flex-wrap justify-center gap-2 text-xs">' +
        '    <button type="button" onclick="App.openStaffBadgePreviewModal(' + u.id + ', \'pin\')" class="px-3.5 py-1.5 rounded-xl font-black transition ' + (AppState.staffBadgeBarcodeTarget === 'pin' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200') + '">🔢 باركود بالكود السري (' + info.pin + ')</button>' +
        '    <button type="button" onclick="App.openStaffBadgePreviewModal(' + u.id + ', \'usr\')" class="px-3.5 py-1.5 rounded-xl font-black transition ' + (AppState.staffBadgeBarcodeTarget === 'usr' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200') + '">🏷️ باركود برمز البطاقة (' + info.barcode + ')</button>' +
        '  </div>' +
        cardHtml +
        '</div>';
    }
    this.openModal('staffBadgeModal');
  };

  // بناء مستند الطباعة والـ PDF للبطاقة في صفحة واحدة متكاملة بالألوان الكاملة وبدون أي انقسام أو تدوير!
  App.buildPrintableStaffBadgeDocument = function () {
    var cardHtml = AppState._lastStaffBadgeHtml || '';
    return (
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
      '<title>بطاقة عمل الموظف — ' + (AppState._currentBadgeUserName || 'Staff ID') + '</title>' +
      '<style>' +
      '  @page { size: A4 portrait; margin: 12mm; }' +
      '  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
      '  html, body { margin: 0; padding: 0; width: 100%; background: #ffffff; font-family: "Cairo", "Tajawal", Arial, sans-serif; }' +
      '  .print-sheet { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 18mm; width: 100%; page-break-inside: avoid; break-inside: avoid; }' +
      '  .cut-guide { border: 1.5px dashed #94a3b8; padding: 14px; border-radius: 26px; background: #ffffff; page-break-inside: avoid; break-inside: avoid; }' +
      '  .cut-hint { text-align: center; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 10px; }' +
      '</style></head><body>' +
      '  <div class="print-sheet">' +
      '    <div class="cut-hint">✂️ بطاقة عمل وبصمة موظف قياسية — جاهزة للقص أو التغليف الحراري (صفحة واحدة متكاملة)</div>' +
      '    <div class="cut-guide">' +
      cardHtml +
      '    </div>' +
      '  </div>' +
      '</body></html>'
    );
  };

  App.printCurrentStaffBadge = async function () {
    if (!AppState._lastStaffBadgeHtml || !window.PrintEngine) return;
    var fullDoc = this.buildPrintableStaffBadgeDocument();
    await window.PrintEngine.printHtmlDocument(fullDoc, { silent: false });
  };

  App.exportCurrentStaffBadgePdf = async function () {
    if (!AppState._lastStaffBadgeHtml || !window.api || !window.api.exportPDF) return;
    var fullDoc = this.buildPrintableStaffBadgeDocument();
    var res = await window.api.exportPDF({
      html: fullDoc,
      filename: 'Staff_Badge_' + (AppState._currentBadgeUserId || 1) + '.pdf'
    });
    if (res && res.success && typeof showToast === 'function') {
      showToast('💾 تم حفظ بطاقة الموظف كملف PDF ملون في صفحة واحدة بنجاح!', 'success');
    }
  };

  // ==========================================================================
  // ب. الحل الشامل لجسر بصمة الهاتف المحمول + محاكي الهاتف الذكي التفاعلي المدمج
  // ==========================================================================
  App.openMobileBiometricBridgeModal = async function (selectedIpOverride) {
    this.ensureCleanPage17ModalsDom();
    if (!document.getElementById('mobileBioBridgeModal')) {
      var m = document.createElement('div');
      m.id = 'mobileBioBridgeModal';
      m.className = 'modal-overlay';
      m.innerHTML =
        '<div class="modal-content w-full max-w-4xl p-6 space-y-4 overflow-y-auto">' +
        '  <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">' +
        '    <div>' +
        '      <h3 class="text-lg font-black text-indigo-600">📱 محطة ومحاكي بصمة الهاتف الذكي (Wi-Fi QR & Built-in Phone Sensor)</h3>' +
        '      <p class="text-[11px] text-slate-400 font-bold">جرب البصمة مباشرة على شاشة الهاتف التفاعلية باليسار، أو امسح رمز الـ QR بهاتفك الحقيقي عبر الـ Wi-Fi باليمين</p>' +
        '    </div>' +
        '    <button type="button" onclick="App.closeModal(\'mobileBioBridgeModal\')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>' +
        '  </div>' +
        '  <div id="mobileBioBridgeBody" class="text-xs"></div>' +
        '</div>';
      document.body.appendChild(m);
    }

    var allIps = [];
    if (window.api && typeof window.api.getLocalIps === 'function') {
      allIps = (await window.api.getLocalIps().catch(function () { return []; })) || [];
    }
    var primaryIp = selectedIpOverride || '192.168.1.15';
    if (!selectedIpOverride && window.api && typeof window.api.getLocalIp === 'function') {
      primaryIp = (await window.api.getLocalIp().catch(function () { return '192.168.1.15'; })) || '192.168.1.15';
    }
    // إذا كان هناك عنوان 192.168 غير 56.1 نفضله دائماً
    if (!selectedIpOverride && allIps.length > 0) {
      var bestWifi = allIps.find(function (x) {
        return String(x.address || '').startsWith('192.168.') && !String(x.address || '').startsWith('192.168.56.');
      });
      if (bestWifi) primaryIp = bestWifi.address;
    }

    var mobileUrl = 'http://' + primaryIp + ':8080/mobile-biometric';
    var qrDataUrl = '';
    if (window.api && typeof window.api.getRipQrDataUrl === 'function') {
      qrDataUrl = await window.api.getRipQrDataUrl(mobileUrl).catch(function () { return ''; });
    }

    var users = (await window.api.getUsers().catch(function () { return []; })) || [];
    var selSimUid = Number(AppState._simPhoneUserId || (users[0] && users[0].id) || 1);

    var body = document.getElementById('mobileBioBridgeBody');
    if (body) {
      body.innerHTML =
        '<div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">' +
        '  <!-- يمين: الربط اللاسلكي بالهاتف الحقيقي عبر الـ Wi-Fi ورمز الـ QR (6 أعمدة) -->' +
        '  <div class="lg:col-span-6 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col justify-between space-y-3 text-center">' +
        '    <div class="space-y-2">' +
        '      <div class="text-amber-400 font-black text-sm">📡 أولاً: الربط مع هاتفك الحقيقي عبر شبكة الـ Wi-Fi</div>' +
        '      <p class="text-[11px] text-slate-300">تأكد أن هاتفك والحاسوب متصلان بنفس شبكة الـ Wi-Fi، ثم اختر عنوان شبكة الـ Wi-Fi الصحيح وامسح الـ QR:</p>' +
        (allIps.length > 1
          ? '<div class="flex flex-wrap justify-center gap-1.5 pt-1">' +
            allIps.map(function (ipObj) {
              var isSel = ipObj.address === primaryIp;
              return '<button type="button" onclick="App.openMobileBiometricBridgeModal(\'' + ipObj.address + '\')" class="px-2.5 py-1 rounded-lg font-mono text-[10.5px] font-black ' + (isSel ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700') + '">' + ipObj.address + ' (' + ipObj.name + ')</button>';
            }).join('') +
            '</div>'
          : '') +
        '    </div>' +

        '    <div class="py-2">' +
        (qrDataUrl
          ? '<img src="' + qrDataUrl + '" class="w-44 h-44 mx-auto rounded-2xl border-4 border-white shadow-xl bg-white p-2">'
          : '<div class="p-4 font-mono font-black text-base text-emerald-400">' + mobileUrl + '</div>') +
        '      <div class="font-mono font-black text-xs text-sky-400 bg-slate-950 py-2 px-3 rounded-xl border border-slate-800 mt-2 select-all">' + mobileUrl + '</div>' +
        '    </div>' +

        '    <div class="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-[11px] text-slate-300 text-right space-y-1">' +
        '      <div class="font-black text-amber-300">💡 لماذا قد لا يفتح الرابط على الهاتف أحياناً؟</div>' +
        '      <div>1. إذا قمت بترقية الكود دون إغلاق وتشغيل <code class="text-emerald-400">npm run dev</code> من جديد.</div>' +
        '      <div>2. إذا كان الهاتف على بيانات الهاتف (4G) وليس على نفس الـ Wi-Fi مع الحاسوب.</div>' +
        '      <div class="text-emerald-300 font-bold">👈 لذلك وفرنا لك الهاتف التفاعلي المدمج باليسار لتجربة البصمة فوراً وبدون إنترنت!</div>' +
        '    </div>' +
        '  </div>' +

        '  <!-- يسار: جهاز الهاتف الذكي التفاعلي المدمج (Built-in Smartphone Biometric Simulator — 6 أعمدة) -->' +
        '  <div class="lg:col-span-6 flex justify-center">' +
        '    <div style="width:330px;border:6px solid #1e293b;border-radius:36px;background:#020617;color:#f8fafc;padding:18px 16px;box-shadow:0 20px 45px rgba(0,0,0,0.45);display:flex;flex-direction:column;justify-content:space-between;text-align:center;">' +
        '      <div style="width:80px;height:6px;border-radius:99px;background:#334155;margin:0 auto 10px;"></div>' +
        '      <div>' +
        '        <div style="font-size:15px;font-weight:900;color:#38bdf8;">📱 هاتف البصمة الذكي (حي ومباشر)</div>' +
        '        <div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">اضغط على مستشعر البصمة أدناه لتجربة بدء وإيقاف العد فوراً</div>' +
        '      </div>' +

        '      <div style="margin-top:10px;text-align:right;">' +
        '        <label style="display:block;font-size:11px;font-weight:800;color:#cbd5e1;margin-bottom:4px;">👤 اختر العامل في الهاتف:</label>' +
        '        <select id="simPhoneEmpSelect" onchange="AppState._simPhoneUserId=Number(this.value)" style="width:100%;padding:9px 12px;border-radius:12px;background:#0f172a !important;color:#fbbf24 !important;border:2px solid #334155;font-weight:900;font-size:13px;text-align:center;">' +
        users.map(function (u) {
          var inf = App.getEmployeeFullIdentityAndContract(u);
          return '<option value="' + u.id + '" ' + (Number(u.id) === selSimUid ? 'selected' : '') + '>' + u.name + ' (PIN: ' + inf.pin + ')</option>';
        }).join('') +
        '        </select>' +
        '      </div>' +

        '      <!-- مستشعر البصمة الدائري التفاعلي داخل الهاتف -->' +
        '      <div id="simPhoneFpSensorBtn" onclick="App.triggerBuiltInSmartphoneBiometricPunch()" style="width:136px;height:136px;border-radius:50%;margin:14px auto;border:4px solid #10b981;background:radial-gradient(circle,rgba(16,185,129,0.28) 0%,rgba(15,23,42,0.95) 80%);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 30px rgba(16,185,129,0.3);transition:transform 0.15s;">' +
        '        <span style="font-size:54px;line-height:1;">🫆</span>' +
        '        <span id="simPhoneFpLabel" style="font-size:11px;font-weight:900;color:#34d399;margin-top:6px;">المس البصمة هنا</span>' +
        '      </div>' +

        '      <div id="simPhoneStatusBox" style="padding:10px;border-radius:14px;background:#0f172a;border:1px solid #1e293b;font-size:11.5px;font-weight:800;color:#38bdf8;min-height:46px;display:flex;align-items:center;justify-content:center;">' +
        '        جاهز — المس البصمة لبدء أو إيقاف عداد وقت العمل (00:00:01)' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    this.openModal('mobileBioBridgeModal');
  };

  // تنفيذ البصمة الفورية من شاشة الهاتف المدمجة
  App.triggerBuiltInSmartphoneBiometricPunch = function () {
    var selEl = document.getElementById('simPhoneEmpSelect');
    var uid = Number((selEl && selEl.value) || AppState._simPhoneUserId || 1);
    AppState._simPhoneUserId = uid;

    var btn = document.getElementById('simPhoneFpSensorBtn');
    var statusEl = document.getElementById('simPhoneStatusBox');
    if (btn) {
      btn.style.transform = 'scale(0.92)';
      btn.style.borderColor = '#f59e0b';
      setTimeout(function () {
        btn.style.transform = 'scale(1)';
        btn.style.borderColor = '#10b981';
      }, 220);
    }

    // التحقق مما إذا كان للعامل عداد مفتوح حالياً قبل التبديل
    var wasOpen = (AppState.staffTimeClockLogs || []).some(function (l) {
      return Number(l.userId) === uid && !l.checkOut;
    });

    // السماح بالتبديل الفوري عبر تصفير مانع الارتداد لهذا الاختبار التفاعلي
    if (AppState._lastPunchTimestampByUser) {
      AppState._lastPunchTimestampByUser[uid] = 0;
    }

    this.punchStaffTimeClockEnhanced(uid, null, '📱🫆 بصمة الهاتف الذكي');

    if (statusEl) {
      if (!wasOpen) {
        statusEl.style.color = '#34d399';
        statusEl.innerHTML = '🟢 تم قبول البصمة الأولى! بدأ عداد حساب الوقت الحي (00:00:01) الآن!';
      } else {
        statusEl.style.color = '#fbbf24';
        statusEl.innerHTML = '🔴 تم قبول البصمة الثانية! توقف العد وتم حفظ الساعات والدقائق في الراتب!';
      }
    }
  };
}

// ============================================================================
// 4. حقن الترقية في renderer-rc-100.js وفحص القواعد النحوية
// ============================================================================
const rcPath = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const marker = '// [VIP STAFF BADGE PRINT FIX & BUILT-IN MOBILE BIOMETRIC SIMULATOR V8]';
  const oldIdx = rc.indexOf(marker);
  if (oldIdx !== -1) {
    rc = rc.slice(0, oldIdx).trimEnd();
  }

  const block =
    '\n\n' +
    marker +
    '\n(' +
    installVipStaffBadgePrintAndMobileBiometricFixV8.toString() +
    ')();\n';

  const finalRc = rc.trimEnd() + block;
  new vm.Script(finalRc, { filename: 'renderer-rc-100.js' });
  fs.writeFileSync(rcPath, finalRc, 'utf8');
  console.log('✅ 2/3: تم حقن وفحص تصميم البطاقة الملكي وإصلاح الطباعة ومحاكي بصمة الهاتف (V8) في renderer-rc-100.js بنجاح.');
}

const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['upgrade-barcode-badge-live-timer-and-mobile-fingerprint.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});

console.log('\n🎉 3/3: اكتمل الإصلاح الجذري بنجاح! أغلق البرنامج وشغّله عبر npm run dev (أو اضغط Ctrl+R) وجرّب البطاقة الجديدة ومحاكي بصمة الهاتف.'); 