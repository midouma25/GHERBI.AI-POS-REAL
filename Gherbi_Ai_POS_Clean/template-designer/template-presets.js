/**
 * template-designer/template-presets.js
 * الإعدادات المسبقة القياسية لقوالب الفواتير والوصولات (Presets)
 */

'use strict';

(function () {
  const PRESETS = {
    modern_a4: {
      name: 'فاتورة A4 احترافية حديثة',
      doc_type: 'invoice',
      paper: 'a4',
      lang: 'ar',
      accentColor: '#1d4ed8',
      fontSize: 12,
      showLogo: true,
      showFiscal: true,
      showCustomerFiscal: true,
      showOldDebt: true,
      showAmountInWords: true,
      showSignature: true,
      columns: {
        index: true,
        barcode: true,
        designation: true,
        qty: true,
        unit: true,
        unitPrice: true,
        tva: true,
        total: true
      },
      footerNote: 'شكراً لتعاملكم معنا — البضاعة المباعة لا تُرد ولا تُستبدل إلا وفق الشروط القانونية.'
    },
    compact_a5: {
      name: 'فاتورة A5 مدمجة سريعة',
      doc_type: 'invoice',
      paper: 'a5',
      lang: 'ar',
      accentColor: '#0f172a',
      fontSize: 11,
      showLogo: true,
      showFiscal: true,
      showCustomerFiscal: false,
      showOldDebt: true,
      showAmountInWords: true,
      showSignature: true,
      columns: {
        index: true,
        barcode: false,
        designation: true,
        qty: true,
        unit: true,
        unitPrice: true,
        tva: false,
        total: true
      },
      footerNote: 'شكراً لثقتكم بمتجرنا.'
    },
    thermal_80: {
      name: 'وصل حراري 80mm مخصص',
      doc_type: 'receipt',
      paper: 'thermal80',
      lang: 'ar',
      accentColor: '#000000',
      fontSize: 11,
      showLogo: true,
      showFiscal: false,
      showCustomerFiscal: false,
      showOldDebt: true,
      showAmountInWords: false,
      showSignature: false,
      columns: {
        index: false,
        barcode: false,
        designation: true,
        qty: true,
        unit: false,
        unitPrice: true,
        tva: false,
        total: true
      },
      footerNote: 'مرحباً بكم دائماً!'
    }
  };

  window.TemplatePresets = {
    PRESETS,
    getPreset(key = 'modern_a4') {
      return JSON.parse(JSON.stringify(PRESETS[key] || PRESETS.modern_a4));
    }
  };
})();