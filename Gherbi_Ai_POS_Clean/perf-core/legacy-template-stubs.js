/**
 * perf-core/legacy-template-stubs.js
 * بديل خفيف وآمن يمنع أي خطأ عند تعطيل ملفات template-designer/* القديمة المكررة
 */
'use strict';
(function () {
  if (!window.TemplateI18n) {
    window.TemplateI18n = { t: function (k, fallback) { return fallback || k || ''; }, lang: 'ar' };
  }
  if (!window.TemplatePresets) {
    window.TemplatePresets = { list: [], get: function () { return null; } };
  }
  if (!window.TemplateRenderer) {
    window.TemplateRenderer = {
      render: function (tpl, data) {
        if (window.GherbiPrintStudioPro && window.GherbiPrintStudioPro.router) {
          return window.GherbiPrintStudioPro.router.renderDoc(tpl && tpl.doc_type ? tpl.doc_type : 'invoice_a4', data || {}, 'print').fullHtml;
        }
        return '';
      }
    };
  }
  if (!window.TemplateBuilder) {
    window.TemplateBuilder = { mount: function () {}, destroy: function () {} };
  }
})();
