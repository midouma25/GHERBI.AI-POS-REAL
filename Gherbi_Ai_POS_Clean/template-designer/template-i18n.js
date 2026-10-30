/**
 * template-designer/template-i18n.js
 * ترجمات مصمم الفواتير والقوالب المرئي باللغات الثلاث
 */

'use strict';

(function () {
  const TD_I18N = {
    ar: {
      title: 'مصمم القوالب والفواتير المرئي',
      subtitle: 'تخصيص شكل الفاتورة، الألوان، الشعار، والأعمدة الظاهرة وحفظها في قاعدة البيانات',
      new_template: 'قالب جديد',
      save_template: 'حفظ القالب',
      paper_a4: 'ورق A4 قياسي',
      paper_a5: 'ورق A5 نصفي',
      paper_thermal: 'حراري 80mm',
      accent_color: 'اللون الرئيسي للقالب',
      show_logo: 'إظهار شعار المتجر',
      show_fiscal: 'إظهار البيانات الجبائية (RC / NIF / AI / NIS)',
      show_old_debt: 'إظهار الرصيد/الدين السابق للزبون',
      show_amount_words: 'إظهار تفقيط المبلغ بالحروف',
      show_signature: 'إظهار خانة الختم والإمضاء',
      footer_note: 'نص تذييل الفاتورة'
    },
    fr: {
      title: 'Concepteur Visuel de Modèles',
      subtitle: 'Personnalisez la mise en page, les couleurs et les colonnes de vos factures',
      new_template: 'Nouveau Modèle',
      save_template: 'Enregistrer',
      paper_a4: 'Papier A4',
      paper_a5: 'Papier A5',
      paper_thermal: 'Thermique 80mm',
      accent_color: 'Couleur Principale',
      show_logo: 'Afficher le Logo',
      show_fiscal: 'Afficher Infos Fiscales (RC / NIF / AI / NIS)',
      show_old_debt: 'Afficher Ancien Solde Client',
      show_amount_words: 'Montant en Toutes Lettres',
      show_signature: 'Zone Cachet & Signature',
      footer_note: 'Note de Pied de Page'
    },
    en: {
      title: 'Visual Template Designer',
      subtitle: 'Customize invoice layout, colors, fiscal fields, and table columns',
      new_template: 'New Template',
      save_template: 'Save Template',
      paper_a4: 'A4 Paper',
      paper_a5: 'A5 Paper',
      paper_thermal: 'Thermal 80mm',
      accent_color: 'Accent Color',
      show_logo: 'Show Shop Logo',
      show_fiscal: 'Show Fiscal IDs (RC / NIF / AI / NIS)',
      show_old_debt: 'Show Customer Previous Balance',
      show_amount_words: 'Show Amount in Words',
      show_signature: 'Show Stamp & Signature Box',
      footer_note: 'Footer Note'
    }
  };

  window.TemplateDesignerI18n = {
    t(key, lang = 'ar') {
      const dict = TD_I18N[lang] || TD_I18N.ar;
      return dict[key] || TD_I18N.ar[key] || key;
    }
  };
})();