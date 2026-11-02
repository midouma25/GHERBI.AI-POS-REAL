/**
 * hotfix-caisse-session.js
 * إصلاح جراحي فوري لتعريف الدوال المفقودة (refreshActiveSession, confirmCaisseTx, confirmOpenShift)
 * التي تسببت في خطأ شاشة الصندوق (view-caisse).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const rcPath = path.join(ROOT, 'renderer-rc-100.js');

if (fs.existsSync(rcPath)) {
  let rc = fs.readFileSync(rcPath, 'utf8');

  const missingMethodsCode = `
  // ============================================================================
  // [HOTFIX] صمام الأمان للدوال المفقودة من الواجهة الأصلية لإدارة الصندوق
  // ============================================================================
  App.refreshActiveSession = async function () {
    if (!AppState.currentUser) return null;
    try {
      var uid = AppState.currentUser.id || 1;
      AppState.activeSession = await window.api.getActiveSession(uid).catch(function(){ return null; });
      
      // تحديث شارة الكاشير العلوية آلياً
      var shiftTxt = document.getElementById('headerShiftText');
      if (shiftTxt) {
        shiftTxt.textContent = AppState.activeSession
          ? (AppState.lang === 'fr' ? 'Session active' : AppState.lang === 'en' ? 'Shift Active' : 'المناوبة نشطة')
          : (AppState.lang === 'fr' ? 'Ouvrir la caisse' : AppState.lang === 'en' ? 'Open Till Shift' : 'فتح مناوبة صندوق');
      }
    } catch (e) {
      AppState.activeSession = null;
    }
    return AppState.activeSession;
  };

  if (typeof App.openCaisseTxModal !== 'function') {
    App.openCaisseTxModal = function (type) {
      var tInp = document.getElementById('caisseTxTypeInput');
      if (tInp) tInp.value = type;
      var title = document.getElementById('caisseTxModalTitle');
      if (title) {
        title.textContent = type === 'cash_in' ? '➕ إيداع نقدي (تغذية الصندوق)' : '➖ سحب نقدي (مصاريف أو سحب للخزنة)';
      }
      var amtInp = document.getElementById('caisseTxAmountInput');
      if (amtInp) amtInp.value = '';
      var descInp = document.getElementById('caisseTxDescInput');
      if (descInp) descInp.value = '';
      this.openModal('caisseTxModal');
    };
  }

  if (typeof App.confirmCaisseTx !== 'function') {
    App.confirmCaisseTx = async function () {
      var type = document.getElementById('caisseTxTypeInput')?.value || 'cash_in';
      var amount = parseFloat(document.getElementById('caisseTxAmountInput')?.value) || 0;
      var desc = document.getElementById('caisseTxDescInput')?.value || '';
      if (amount <= 0) {
        if (typeof showToast === 'function') showToast('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'warning');
        return;
      }
      
      await window.api.addCaisseTransaction({
        user_id: AppState.currentUser ? AppState.currentUser.id : 1,
        type: type,
        amount: amount,
        description: desc
      });
      
      this.closeModal('caisseTxModal');
      if (typeof this.renderCaisseView === 'function') await this.renderCaisseView();
      if (typeof showToast === 'function') showToast('تم تسجيل الحركة النقدية بنجاح', 'success');
    };
  }

  if (typeof App.confirmOpenShift !== 'function') {
    App.confirmOpenShift = async function () {
      var bal = parseFloat(document.getElementById('openShiftBalanceInput')?.value) || 0;
      var uid = AppState.currentUser ? AppState.currentUser.id : 1;
      
      await window.api.openCaisseSession({ userId: uid, openingBalance: bal });
      this.closeModal('openShiftModal');
      
      await this.refreshActiveSession();
      if (typeof this.renderCaisseView === 'function') await this.renderCaisseView();
      if (typeof showToast === 'function') showToast('✅ تم فتح المناوبة بنجاح!', 'success');
    };
  }
`;

  if (!rc.includes('App.refreshActiveSession = async function')) {
    rc = rc.replace(
      'App.renderCaisseView = async function',
      missingMethodsCode + '\n  App.renderCaisseView = async function'
    );
    
    // فحص القواعد النحوية قبل الحفظ
    new vm.Script(rc, { filename: 'renderer-rc-100.js' });
    fs.writeFileSync(rcPath, rc, 'utf8');
    console.log('✅ تم حقن الدوال المفقودة (refreshActiveSession, confirmOpenShift, confirmCaisseTx) بنجاح!');
  } else {
    console.log('⚠️ الدوال موجودة بالفعل، لا داعي للتحديث.');
  }
}

// تنظيف ونقل السكربت للأرشيف
const archiveDir = path.join(ROOT, '..', 'scripts_archive_backup');
['hotfix-caisse-session.js'].forEach((f) => {
  const fp = path.join(ROOT, f);
  if (fs.existsSync(fp)) {
    try { fs.renameSync(fp, path.join(archiveDir, f)); } catch (_) {}
  }
});
console.log('🎉 اكتمل الإصلاح. اضغط Ctrl+R لتحديث البرنامج!');