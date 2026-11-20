/**
 * print-studio-pro/studio-templates-34.js
 * المرحلة 3: مكتبة الـ 34 مستنداً افتراضياً (Par Défaut) كاملة بدون أي اختصار
 */
'use strict';
(function buildStudioTemplates34Module() {
  (function initPrintStudioProTemplates34() {
    'use strict';

    const PSP = window.GherbiPrintStudioPro;
    if (!PSP) return;

    const CATEGORIES = [
      { id: 'ALL', label: 'كل المستندات', icon: 'apps', count: 34 },
      { id: 'POS', label: 'المبيعات والكاشير', icon: 'point_of_sale', count: 9 },
      { id: 'CREDIT', label: 'الديون والوفاء', icon: 'credit_score', count: 11 },
      { id: 'PURCHASES', label: 'المشتريات والموردين', icon: 'local_shipping', count: 4 },
      { id: 'INVENTORY', label: 'المخزون والتصنيع', icon: 'inventory_2', count: 4 },
      { id: 'FINANCE', label: 'الصندوق والورديات والجباية', icon: 'account_balance', count: 6 }
    ];

    const TEMPLATES_34 = [
      // ======================================================================
      // أ) المبيعات والكاشير والتوصيل والضمان (9 مستندات: #1 .. #9)
      // ======================================================================
      {
        id: 'receipt_thermal',
        num: 1,
        cat: 'POS',
        name: 'تذكرة كاشير حرارية شاملة',
        cleanTitle: 'تذكرة مبيعات الكاشير / Ticket de Caisse',
        defaultPaper: '80mm',
        defaultTheme: 'executive_dark',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'شاشة المبيعات والكاشير (Échap / F1)',
        proDesc: 'تذكرة سوبرماركت حرارية مضغوطة تتكيف تلقائياً بين الزبون العابر (0 نقاط) والزبون الوفي.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'payment_change',
          'f8_vip_card',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'TIC-2026-0150',
          date: '2026-11-19 17:30',
          customerId: 3,
          partyTitle: 'الزبون الوفي:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          partyAddress: 'قسنطينة — الجزائر',
          paymentMethod: 'نقداً (Espèces)',
          previousBalance: 270,
          loyaltyTotalBalance: 79,
          loyaltyPointsEarned: 3,
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 2 لتر (Elio)', unit: 'قارورة', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 },
            { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر', unit: 'علبة', qty: 2, price: 150, discount: 0, tva: 0, subtotal: 300 },
            { barcode: '6130005000018', name: 'ماء معدني إيفري 1.5 لتر (Ifri)', unit: 'قارورة', qty: 2, price: 45, discount: 0, tva: 0, subtotal: 90 }
          ],
          subtotal: 660,
          discount: 0,
          total: 660,
          paidAmount: 660,
          receivedAmount: 1000,
          remainingDebt: 0
        }
      },
      {
        id: 'invoice_a4',
        num: 2,
        cat: 'POS',
        name: 'فاتورة مبيعات تجارية رسمية (A4)',
        cleanTitle: 'فاتورة مبيعات تجارية رسمية / Facture Commerciale',
        defaultPaper: 'a4',
        defaultTheme: 'royal_blue',
        defaultLang: 'ar',
        sourcePage: 'sales',
        sourceLabel: 'شاشة المبيعات + سجل المبيعات والضمان',
        proDesc: 'فاتورة مؤسسات رسمية كاملة بالبيانات الجبائية والتفقيط بالحروف وحساب RIP والإمضاء.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'debt_ledger_box',
          'bank_rip_ccp',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: true, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'FAC-2026-0150',
          date: '2026-11-19 11:15',
          customerId: 3,
          partyTitle: 'الزبون / المؤسسة:',
          partyName: 'مؤسسة الأمل للتجارة والتوزيع — أمين بن يحيى',
          partyPhone: '0550112233',
          partyAddress: 'المنطقة الصناعية — قسنطينة',
          partyRc: '25/00-0998877B21',
          partyNif: '002125099887744',
          paymentMethod: 'نقداً / تحويل بنكي',
          previousBalance: 0,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio Cevital)', unit: 'قارورة', qty: 10, price: 650, discount: 0, tva: 0, subtotal: 6500 },
            { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (كرتونة 12)', unit: 'كرتونة', qty: 5, price: 1800, discount: 0, tva: 0, subtotal: 9000 },
            { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', unit: 'علبة', qty: 10, price: 320, discount: 0, tva: 0, subtotal: 3200 }
          ],
          subtotal: 18700,
          discount: 0,
          total: 18700,
          paidAmount: 18700,
          receivedAmount: 18700,
          remainingDebt: 0
        }
      },
      {
        id: 'invoice_a5',
        num: 3,
        cat: 'POS',
        name: 'فاتورة مبيعات مدمجة نصفية (A5)',
        cleanTitle: 'فاتورة مبيعات مدمجة / Bon & Facture A5',
        defaultPaper: 'a5',
        defaultTheme: 'emerald_dz',
        defaultLang: 'ar',
        sourcePage: 'sales',
        sourceLabel: 'سجل المبيعات والكاشير',
        proDesc: 'فاتورة نصف ورقة أنيقة وسريعة لتجارة التجزئة ونصف الجملة مع كشف الرصيد.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'debt_ledger_box',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'FA5-2026-0089',
          date: '2026-11-19 14:20',
          customerId: 3,
          partyTitle: 'الزبون:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'نقداً (Espèces)',
          previousBalance: 270,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: '6130003000034', name: 'جبن طري شيدر الصومام 16 قطعة', unit: 'علبة', qty: 4, price: 210, discount: 0, tva: 0, subtotal: 840 },
            { barcode: '6130008000022', name: 'كسكس ماما رقيق 1 كغ (Mama)', unit: 'كيس', qty: 5, price: 160, discount: 0, tva: 0, subtotal: 800 }
          ],
          subtotal: 1640,
          discount: 0,
          total: 1640,
          paidAmount: 1640,
          receivedAmount: 1640,
          remainingDebt: 0
        }
      },
      {
        id: 'invoice_2xa5',
        num: 4,
        cat: 'POS',
        name: 'فاتورة مزدوجة نسختان (2×A5 Landscape)',
        cleanTitle: 'فاتورة مبيعات (نسخة الزبون + نسخة الأرشيف)',
        defaultPaper: '2xa5',
        defaultTheme: 'royal_blue',
        defaultLang: 'ar',
        sourcePage: 'sales',
        sourceLabel: 'سجل المبيعات (توفير 50% من ورق A4)',
        proDesc: 'نسختان متطابقتان جنباً إلى جنب في ورقة A4 واحدة بالعرض (للزبون وللأرشيف).',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'debt_ledger_box',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'F2A5-2026-0042',
          date: '2026-11-19 15:00',
          customerId: 3,
          partyTitle: 'الزبون:',
          partyName: 'مؤسسة الأمل للتجارة',
          partyPhone: '0550112233',
          paymentMethod: 'نقداً',
          previousBalance: 0,
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر', unit: 'قارورة', qty: 4, price: 650, discount: 0, tva: 0, subtotal: 2600 },
            { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ', unit: 'علبة', qty: 5, price: 320, discount: 0, tva: 0, subtotal: 1600 }
          ],
          subtotal: 4200,
          discount: 0,
          total: 4200,
          paidAmount: 4200,
          receivedAmount: 4200,
          remainingDebt: 0
        }
      },
      {
        id: 'delivery_note',
        num: 5,
        cat: 'POS',
        name: 'وصل تسليم وتوصيل بضاعة (BL — A4)',
        cleanTitle: 'وصل تسليم ونقل بضاعة / Bon de Livraison (BL)',
        defaultPaper: 'a4',
        defaultTheme: 'emerald_dz',
        defaultLang: 'ar',
        sourcePage: 'sales',
        sourceLabel: 'سجل المبيعات والتوصيل',
        proDesc: 'يركز على الكميات والطرود (Colisage) وبيانات السائق والمركبة بدون أسعار افتراضياً.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'colisage_summary',
          'delivery_driver',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: false, discount: false, tva: false, subtotal: false },
        sampleData: {
          docNumber: 'BL-2026-0061',
          date: '2026-11-19 09:45',
          customerId: 3,
          partyTitle: 'المرسل إليه (الزبون):',
          partyName: 'مؤسسة الأمل للتجارة — قسنطينة',
          partyPhone: '0550112233',
          partyAddress: 'المدينة الجديدة علي منجلي — قسنطينة',
          driverName: 'كريم بن صالح',
          vehiclePlate: '00452-125-25',
          paymentMethod: 'تسليم بضاعة مطابقة',
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (صندوق 4 قارورات)', unit: 'صندوق', qty: 15, price: 2600, discount: 0, tva: 0, subtotal: 39000 },
            { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (كرتونة 12 علبة)', unit: 'كرتونة', qty: 20, price: 1800, discount: 0, tva: 0, subtotal: 36000 }
          ],
          subtotal: 75000,
          discount: 0,
          total: 75000,
          paidAmount: 75000,
          receivedAmount: 75000,
          remainingDebt: 0
        }
      },
      {
        id: 'proforma',
        num: 6,
        cat: 'POS',
        name: 'فاتورة شكلية / عرض سعر (Proforma A4)',
        cleanTitle: 'فاتورة شكلية (عرض سعر رسمي) / Facture Proforma',
        defaultPaper: 'a4',
        defaultTheme: 'royal_blue',
        defaultLang: 'ar',
        sourcePage: 'proformas',
        sourceLabel: 'الفواتير الشكلية وعروض الأسعار',
        proDesc: 'عرض سعر رسمي للشركات والإدارات مع تفصيل الضريبة HT/TVA وحساب RIP ومدة الصلاحية.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'tax_ifu_g12',
          'totals_waterfall',
          'bank_rip_ccp',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: true, subtotal: true },
        sampleData: {
          docNumber: 'PRO-2026-0024',
          date: '2026-11-19 10:00',
          customerId: 4,
          partyTitle: 'الجهة الطالبة للعرض:',
          partyName: 'مديرية الخدمات الجامعية — قسنطينة',
          partyPhone: '031901122',
          partyAddress: 'قسنطينة — الجزائر',
          paymentMethod: 'عرض سعر صالح لمدة 15 يوماً',
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (تموين)', unit: 'قارورة', qty: 50, price: 650, discount: 0, tva: 19, subtotal: 32500 },
            { barcode: '6130008000022', name: 'كسكس ماما رقيق 1 كغ', unit: 'كيس', qty: 100, price: 160, discount: 0, tva: 19, subtotal: 16000 }
          ],
          subtotal: 48500,
          discount: 0,
          tvaAmount: 9215,
          total: 57715,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 57715
        }
      },
      {
        id: 'customer_order',
        num: 7,
        cat: 'POS',
        name: 'سند طلبية زبون وحجز مخزون (BC — A4)',
        cleanTitle: 'سند طلبية زبون وحجز بضاعة / Bon de Commande (BC)',
        defaultPaper: 'a4',
        defaultTheme: 'amber_gold',
        defaultLang: 'ar',
        sourcePage: 'orders',
        sourceLabel: 'طلبيات الزبائن',
        proDesc: 'يوثق الأصناف المحجوزة في المخزون ومبلغ العربون المدفوع (Acompte) والباقي عند التسليم.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'order_reservation',
          'totals_waterfall',
          'delivery_driver',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'BC-2026-0033',
          date: '2026-11-19 13:10',
          customerId: 5,
          partyTitle: 'الزبون صاحب الطلبية:',
          partyName: 'فارس بوزيد (طلبية محجوزة بالمخزن)',
          partyPhone: '0661445566',
          paymentMethod: 'عربون مسبق (6,000 د.ج) + الباقي عند التسليم',
          items: [
            { barcode: '6130007000030', name: 'شوكولاتة الطلاء ماكسون 350غ (كرتونة 24 علبة)', unit: 'كرتونة', qty: 2, price: 8000, discount: 0, tva: 0, subtotal: 16000 }
          ],
          subtotal: 16000,
          discount: 0,
          total: 16000,
          paidAmount: 6000,
          receivedAmount: 6000,
          remainingDebt: 10000
        }
      },
      {
        id: 'credit_note',
        num: 8,
        cat: 'POS',
        name: "إشعار دائن / مرتجع مبيعات (Avoir A4)",
        cleanTitle: "إشعار دائن (مرتجع مبيعات) / Facture d'Avoir",
        defaultPaper: 'a4',
        defaultTheme: 'crimson_bold',
        defaultLang: 'ar',
        sourcePage: 'sales',
        sourceLabel: 'سجل المبيعات والمرتجعات',
        proDesc: 'وثيقة محاسبية رسمية لإرجاع بضاعة وتخفيض دين الزبون أو رد القيمة نقداً.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'debt_ledger_box',
          'return_policy',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'AV-2026-0012',
          date: '2026-11-19 16:05',
          customerId: 3,
          partyTitle: 'الزبون المستفيد من الإشعار:',
          partyName: 'أمين بن يحيى (مرتجع من الفاتورة #91)',
          partyPhone: '0550112233',
          paymentMethod: 'خصم مباشر من رصيد دين الزبون',
          previousBalance: 270,
          items: [
            { barcode: '6130009000014', name: 'مرتجع سليم للمخزن: طماطم مصبرة عمر بن عمر 800غ', unit: 'علبة', qty: 1, price: 290, discount: 0, tva: 0, subtotal: 290 }
          ],
          subtotal: 290,
          discount: 0,
          total: 290,
          paidAmount: 290,
          receivedAmount: 290,
          remainingDebt: 0
        }
      },
      {
        id: 'warranty_cert',
        num: 9,
        cat: 'POS',
        name: 'شهادة ضمان رسمية (Garantie A5)',
        cleanTitle: 'شهادة ضمان رسمية ومعتمدة / Certificat de Garantie',
        defaultPaper: 'a5',
        defaultTheme: 'royal_blue',
        defaultLang: 'ar',
        sourcePage: 'sales',
        sourceLabel: 'سجل المبيعات والضمان',
        proDesc: 'شهادة ضمان مختومة تتضمن الرقم التسلسلي (IMEI / S-N) ومدة الضمان وشروط الصيانة.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'warranty_serial',
          'return_policy',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: false, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'GAR-2026-0077',
          date: '2026-11-19 12:30',
          customerId: 3,
          partyTitle: 'المستفيد من الضمان:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'ضمان رسمي لمدة 12 شهراً',
          items: [
            { barcode: 'SN-869412005478', name: 'جهاز كهرومنزلي ممتاز — مشمول بضمان 12 شهراً (S/N: 869412005478)', unit: 'جهاز', qty: 1, price: 14500, discount: 0, tva: 0, subtotal: 14500 }
          ],
          subtotal: 14500,
          discount: 0,
          total: 14500,
          paidAmount: 14500,
          receivedAmount: 14500,
          remainingDebt: 0
        }
      },

      // ======================================================================
      // ب) منظومة الديون والكريدي والزبون الوفي (11 مستنداً: #10 .. #20)
      // ======================================================================
      {
        id: 'debt_confirm_ticket_80mm',
        num: 10,
        cat: 'CREDIT',
        name: 'تذكرة تأكيد عملية دين جديد (Alt+D — 80mm)',
        cleanTitle: 'وصل تأكيد عملية بيع بالدين / Confirmation de Crédit',
        defaultPaper: '80mm',
        defaultTheme: 'crimson_bold',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'شاشة المبيعات — تأكيد الدين (Alt+D)',
        proDesc: 'تذكرة حرارية توثق السلع المأخوذة بالدين، الدين السابق، والدين التراكمي الجديد بالسنتيم مع إمضاء الزبون.',
        isNew: true,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'alt_d_credit_box',
          'f8_vip_card',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'CRED-2026-0115',
          date: '2026-11-19 17:10',
          customerId: 3,
          partyTitle: 'الزبون الوفي المدين:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'بيع بالدين الآجل (Alt+D)',
          previousBalance: 270,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 2 لتر (Elio)', unit: 'قارورة', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 },
            { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ', unit: 'علبة', qty: 1, price: 320, discount: 0, tva: 0, subtotal: 320 }
          ],
          subtotal: 590,
          discount: 0,
          total: 590,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 590
        }
      },
      {
        id: 'pos_partial_credit_80mm',
        num: 11,
        cat: 'CREDIT',
        name: 'تذكرة بيع بالدفع الجزئي والباقي دين (Alt+D — 80mm)',
        cleanTitle: 'وصل بيع (دفع جزئي + الباقي في الدين)',
        defaultPaper: '80mm',
        defaultTheme: 'crimson_bold',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'شاشة المبيعات — دفع جزئي + دين (Alt+D)',
        proDesc: 'تبرز السلع المشتراة اليوم، المبلغ المدفوع نقداً للكاشير، والباقي المضاف لكرني ديون الزبون.',
        isNew: true,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'alt_d_credit_box',
          'f8_vip_card',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'PART-2026-0094',
          date: '2026-11-19 17:15',
          customerId: 3,
          partyTitle: 'الزبون الوفي:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'دفع جزئي (200 د.ج) + الباقي دين (390 د.ج)',
          previousBalance: 270,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 2 لتر', unit: 'قارورة', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 },
            { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ', unit: 'علبة', qty: 1, price: 320, discount: 0, tva: 0, subtotal: 320 }
          ],
          subtotal: 590,
          discount: 0,
          total: 590,
          paidAmount: 200,
          receivedAmount: 200,
          remainingDebt: 390
        }
      },
      {
        id: 'payment_receipt',
        num: 12,
        cat: 'CREDIT',
        name: 'وصل قبض وتسديد دين زبون (Alt+V — 80mm / A5)',
        cleanTitle: 'وصل استلام دفعة تسديد دين / Reçu de Règlement',
        defaultPaper: '80mm',
        defaultTheme: 'emerald_dz',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'شاشة المبيعات — تسديد الديون (Alt+V) + الزبائن',
        proDesc: 'يوثق المبلغ المقبوض من الزبون، الدين السابق قبل التسديد، وصافي المتبقي بالدينار والسنتيم.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'alt_v_settlement_box',
          'f8_vip_card',
          'footer_terms'
        ],
        defaultColumns: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'REC-2026-0118',
          date: '2026-11-19 17:20',
          customerId: 3,
          partyTitle: 'استلمنا من الزبون الوفي:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'دفعة نقدية لتسديد الدين (Alt+V)',
          previousBalance: 370,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: 'REC-118', name: 'دفعة تسديد نقدية مخصومة من حساب الكريدي', unit: 'دفعة', qty: 1, price: 100, discount: 0, tva: 0, subtotal: 100 }
          ],
          subtotal: 100,
          discount: 0,
          total: 100,
          paidAmount: 100,
          receivedAmount: 100,
          remainingDebt: 0,
          customerCurrentTotalDebt: 270
        }
      },
      {
        id: 'customer_carnet_80mm',
        num: 13,
        cat: 'CREDIT',
        name: 'تذكرة كرني ديون الزبون الوفي (كرني 80mm — Alt+H)',
        cleanTitle: 'تذكرة كرني ديون الزبون الوفي / Carnet de Crédit 80mm',
        defaultPaper: '80mm',
        defaultTheme: 'crimson_bold',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'هيستوريك الديون (Alt+H) — زر كرني 80mm',
        proDesc: 'تذكرة حرارية سريعة تلخص للزبون فواتيره الآجلة والمسدد منها وصافي الدين المتبقي بالسنتيم.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'carnet_credit_box',
          'items_table',
          'f8_vip_card',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'CARNET-FID-00003',
          date: '2026-11-19 17:25',
          customerId: 3,
          partyTitle: 'صاحب الكرني (الزبون الوفي):',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'إجمالي المشتريات: 22,952.20 | المسدد: 22,682.20 د.ج',
          previousBalance: 270,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: 'FAC-091', name: 'فاتورة دين #91 (2026-11-17) — باقي غير مسدد', unit: 'دين قائم', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 }
          ],
          subtotal: 270,
          discount: 0,
          total: 270,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 270,
          customerCurrentTotalDebt: 270
        }
      },
      {
        id: 'customer_ledger_a4',
        num: 14,
        cat: 'CREDIT',
        name: 'كشف حساب وديون الزبون المفصل (كشف A4 — Alt+H)',
        cleanTitle: 'كشف حساب وديون الزبون المفصل / Relevé de Compte Client A4',
        defaultPaper: 'a4',
        defaultTheme: 'royal_blue',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'هيستوريك الديون (Alt+H) — زر A4 + الزبائن',
        proDesc: 'تقرير A4 محاسبي رسمي يعرض كافة فواتير الزبون ودفعات التسديد وصافي الدين المتبقي بالسنتيم.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'debt_ledger_box',
          'items_table',
          'totals_waterfall',
          'bank_rip_ccp',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'REL-2026-0003',
          date: '2026-11-19 17:25',
          customerId: 3,
          partyTitle: 'كشف حساب الزبون الوفي:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          partyAddress: 'قسنطينة — الجزائر',
          paymentMethod: 'المشتريات: 22,952.20 د.ج | المسدد: 22,682.20 د.ج',
          previousBalance: 0,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: 'FAC-071', name: 'فاتورة مبيعات رقم #71 (مسددة بالكامل)', unit: 'مسددة ✔', qty: 1, price: 22657.2, discount: 0, tva: 0, subtotal: 0 },
            { barcode: 'FAC-091', name: 'فاتورة بيع بالدين رقم #91 (الإجمالي: 295 | المدفوع: 25 | الباقي: 270 د.ج)', unit: 'دين قائم', qty: 1, price: 295, discount: 0, tva: 0, subtotal: 270 }
          ],
          subtotal: 270,
          discount: 0,
          total: 270,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 270,
          customerCurrentTotalDebt: 270
        }
      },
      {
        id: 'customer_debt_history_a4',
        num: 15,
        cat: 'CREDIT',
        name: 'هيستوريك فواتير الدين والسلع المأخوذة بالتفصيل (Alt+H — A4)',
        cleanTitle: 'بيان تفصيلي للسلع المأخوذة بالدين ودفعات التسديد / Historique des Articles à Crédit',
        defaultPaper: 'a4',
        defaultTheme: 'indigo_pro',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'هيستوريك الديون (Alt+H) — تبويب الفواتير والسلع',
        proDesc: 'يوضح للزبون بالتاريخ والساعة كل سلعة أخذها في فواتير الدين مع كميتها وسعرها والمبالغ المسددة.',
        isNew: true,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'alt_h_items_history_note',
          'items_table',
          'debt_ledger_box',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'HIST-ITEMS-0003',
          date: '2026-11-19 17:30',
          customerId: 3,
          partyTitle: 'تفصيل السلع المسحوبة بالدين للزبون:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'جرد تفصيلي للسلع المأخوذة على الحساب',
          previousBalance: 0,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: 'FAC-091', name: 'حليب كانديا 1 لتر (فاتورة #91 بتاريخ 2026-11-17)', unit: 'علبة', qty: 1, price: 150, discount: 0, tva: 0, subtotal: 150 },
            { barcode: 'FAC-091', name: 'تونة بالزيت ريكامار 80غ (فاتورة #91 بتاريخ 2026-11-17)', unit: 'علبة', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 },
            { barcode: 'REC-118', name: 'دفعة تسديد نقدية مخصومة من مجموع السلع أعلاه', unit: 'تسديد (-)', qty: 1, price: -25, discount: 0, tva: 0, subtotal: -25 }
          ],
          subtotal: 270,
          discount: 0,
          total: 270,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 270,
          customerCurrentTotalDebt: 270
        }
      },
      {
        id: 'global_debtors_register_a4',
        num: 16,
        cat: 'CREDIT',
        name: 'السجل العام لجميع الزبائن المدينين بالمتجر (Carnet Global A4)',
        cleanTitle: 'السجل الرسمي العام لديون الزبائن / État Global des Crédits Clients',
        defaultPaper: 'a4',
        defaultTheme: 'executive_dark',
        defaultLang: 'ar',
        sourcePage: 'customers',
        sourceLabel: 'هيستوريك الديون (Alt+H) + صفحة الزبائن',
        proDesc: 'جدول رسمي لصاحب المحل يجمع كافة الزبائن المدينين مع هواتفهم وصافي الدين المستحق بالدينار والسنتيم.',
        isNew: true,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: false, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'REG-DEBTS-2026',
          date: '2026-11-19 17:35',
          customerId: 1,
          partyTitle: 'إدارة المتجر والخزينة:',
          partyName: 'جرد شامل للذمم والديون المستحقة لدى الزبائن',
          paymentMethod: 'السجل العام للمدينين (Carnet Global)',
          items: [
            { barcode: 'FID-00003', name: '👑 أمين بن يحيى (📞 0550112233 — المشتريات: 22,952.20 | المسدد: 22,682.20)', unit: '⭐ 79 ن', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 },
            { barcode: 'FID-00005', name: '👑 فارس بوزيد (📞 0661445566 — المشتريات: 16,000.00 | المسدد: 14,500.00)', unit: '⭐ 42 ن', qty: 1, price: 1500, discount: 0, tva: 0, subtotal: 1500 }
          ],
          subtotal: 1770,
          discount: 0,
          total: 1770,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 1770
        }
      },
      {
        id: 'f8_vip_loyalty_debt_card_80mm',
        num: 17,
        cat: 'CREDIT',
        name: 'بطاقة الوضعية الشاملة للزبون الوفي: النقاط + الديون (F8 — 80mm)',
        cleanTitle: 'بطاقة وضعية الزبون الوفي (النقاط + الديون) / Bilan Client VIP',
        defaultPaper: '80mm',
        defaultTheme: 'amber_gold',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'شاشة المبيعات — نافذة الزبون الوفي (F8)',
        proDesc: 'تذكرة شاملة للزبون الوفي تجمع رصيد نقاط الوفاء وقيمتها بالدينار مع كشف ديونه الحالية.',
        isNew: true,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'f8_vip_card',
          'items_table',
          'carnet_credit_box',
          'vip_coupon',
          'footer_terms'
        ],
        defaultColumns: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'F8-VIP-00003',
          date: '2026-11-19 17:35',
          customerId: 3,
          partyTitle: 'العضو الوفي:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: '⭐ النقاط: 79 ن (158 د.ج) | 💳 الدين: 270.00 د.ج',
          previousBalance: 270,
          loyaltyTotalBalance: 79,
          items: [
            { barcode: 'VIP-PTS', name: '⭐ رصيد نقاط الوفاء المتاح للاستبدال (79 نقطة × 2 د.ج)', unit: 'مكافأة', qty: 79, price: 2, discount: 0, tva: 0, subtotal: 158 },
            { barcode: 'VIP-DEBT', name: '💳 صافي الدين المتبقي المسجل على الحساب حالياً', unit: 'كريدي', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 270 }
          ],
          subtotal: 270,
          discount: 0,
          total: 270,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 270,
          customerCurrentTotalDebt: 270
        }
      },
      {
        id: 'loyalty_vip_card_80mm',
        num: 18,
        cat: 'CREDIT',
        name: 'قسيمة مكافآت واستبدال نقاط الوفاء (F9 — 80mm)',
        cleanTitle: 'قسيمة مكافآت وتخفيض نقاط الوفاء / Bon Fidélité VIP',
        defaultPaper: '80mm',
        defaultTheme: 'amber_gold',
        defaultLang: 'ar',
        sourcePage: 'pos',
        sourceLabel: 'شاشة المبيعات — خصم نقاط الوفاء (F9)',
        proDesc: 'توثق عملية استبدال نقاط الوفاء بتخفيض نقدي فوري في الفاتورة مع الرصيد المتبقي من النقاط.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'loyalty_points',
          'items_table',
          'vip_coupon',
          'footer_terms'
        ],
        defaultColumns: { index: false, barcode: false, name: true, unit: false, qty: true, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'FID-REDEEM-03',
          date: '2026-11-19 17:40',
          customerId: 3,
          partyTitle: 'الزبون الوفي المستفيد:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'استبدال نقاط الوفاء بتخفيض نقدي (F9)',
          loyaltyPointsUsed: 50,
          loyaltyPointsEarned: 0,
          loyaltyTotalBalance: 29,
          items: [
            { barcode: 'PTS-USED', name: 'استبدال 50 نقطة وفاء مقابل تخفيض فوري بقيمة 100 د.ج', unit: 'نقطة', qty: 50, price: 2, discount: 0, tva: 0, subtotal: 100 }
          ],
          subtotal: 100,
          discount: 0,
          total: 100,
          paidAmount: 100,
          receivedAmount: 100,
          remainingDebt: 0
        }
      },
      {
        id: 'recap_invoice_a4',
        num: 19,
        cat: 'CREDIT',
        name: 'فاتورة مبيعات مجمعة للزبون (Récapitulative A4)',
        cleanTitle: 'فاتورة مبيعات مجمعة / Facture Récapitulative',
        defaultPaper: 'a4',
        defaultTheme: 'executive_dark',
        defaultLang: 'ar',
        sourcePage: 'customers',
        sourceLabel: 'صفحة الزبائن — الفواتير المجمعة',
        proDesc: 'تجمع كافة مسحوبات وفواتير الزبون خلال شهر أو فترة محددة في فاتورة محاسبية موحدة.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'debt_ledger_box',
          'bank_rip_ccp',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'FR-2026-0008',
          date: '2026-11-19 16:40',
          customerId: 3,
          partyTitle: 'الزبون / المؤسسة:',
          partyName: 'مؤسسة الأمل للتجارة (أمين بن يحيى)',
          partyPhone: '0550112233',
          paymentMethod: 'تجميع فواتير الفترة (Facture Récapitulative)',
          previousBalance: 0,
          items: [
            { barcode: '6130001000012', name: 'إجمالي مسحوبات: زيت مائدة إيليو 5 لتر (خلال الفترة)', unit: 'قارورة', qty: 24, price: 650, discount: 0, tva: 0, subtotal: 15600 },
            { barcode: '6130002000011', name: 'إجمالي مسحوبات: حليب كانديا 1 لتر (خلال الفترة)', unit: 'علبة', qty: 60, price: 150, discount: 0, tva: 0, subtotal: 9000 }
          ],
          subtotal: 24600,
          discount: 0,
          total: 24600,
          paidAmount: 24330,
          receivedAmount: 24330,
          remainingDebt: 270
        }
      },
      {
        id: 'installment_contract',
        num: 20,
        cat: 'CREDIT',
        name: 'عقد بيع بالتقسيط وجدول الأقساط الشهرية (A4)',
        cleanTitle: 'عقد بيع بالتقسيط وجدولة الأقساط / Contrat de Vente par Facilité',
        defaultPaper: 'a4',
        defaultTheme: 'amber_gold',
        defaultLang: 'ar',
        sourcePage: 'customers',
        sourceLabel: 'الزبائن وعقود الأقساط الشهرية',
        proDesc: 'عقد التزام رسمي يوضح السلعة المباعة، التسبيق، وجدول الأقساط الشهرية مع إمضاء المشتري.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'installments_box',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'INST-2026-0019',
          date: '2026-11-19 11:00',
          customerId: 3,
          partyTitle: 'المشتري بالتقسيط:',
          partyName: 'أمين بن يحيى (FID-00003)',
          partyPhone: '0550112233',
          paymentMethod: 'بيع بالتقسيط على 3 أشهر (تسبيق: 6,000 د.ج)',
          installmentMonths: 3,
          items: [
            { barcode: '6130099001122', name: 'جهاز كهرومنزلي ممتاز — بيع بالتقسيط المريح', unit: 'جهاز', qty: 1, price: 15000, discount: 0, tva: 0, subtotal: 15000 }
          ],
          subtotal: 15000,
          discount: 0,
          total: 15000,
          paidAmount: 6000,
          receivedAmount: 6000,
          remainingDebt: 9000
        }
      },

      // ======================================================================
      // ج) المشتريات والموردين (4 مستندات: #21 .. #24)
      // ======================================================================
      {
        id: 'purchase_invoice',
        num: 21,
        cat: 'PURCHASES',
        name: 'سند استلام وفاتورة شراء وتموين (BR — A4)',
        cleanTitle: 'سند استلام بضاعة وفاتورة شراء / Bon de Réception (BR)',
        defaultPaper: 'a4',
        defaultTheme: 'executive_dark',
        defaultLang: 'ar',
        sourcePage: 'purchases',
        sourceLabel: 'المشتريات والفواتير',
        proDesc: 'يوثق البضاعة المستلمة من المورد، كمياتها، تكلفة الشراء، والمدفوع والمتبقي للمورد.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'supplier_reception',
          'items_table',
          'colisage_summary',
          'totals_waterfall',
          'debt_ledger_box',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'BR-2026-0041',
          date: '2026-11-19 08:30',
          customerId: 101,
          partyTitle: 'المورد / الشركة الممونة:',
          partyName: 'شركة الشرق للتوزيع الغذائي (Fournisseur)',
          partyPhone: '031887766',
          paymentMethod: 'تموين مخزني — دفع جزئي والباقي لأجل',
          previousBalance: 15000,
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (دفعة تموين)', unit: 'قارورة', qty: 100, price: 580, discount: 0, tva: 0, subtotal: 58000 },
            { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر', unit: 'علبة', qty: 200, price: 130, discount: 0, tva: 0, subtotal: 26000 }
          ],
          subtotal: 84000,
          discount: 0,
          total: 84000,
          paidAmount: 50000,
          receivedAmount: 50000,
          remainingDebt: 34000
        }
      },
      {
        id: 'supplier_payment_receipt',
        num: 22,
        cat: 'PURCHASES',
        name: 'سند صرف وتسديد دفعة لمورد (Versement A5 / 80mm)',
        cleanTitle: 'سند تسديد دفعة لمورد / Bon de Versement Fournisseur',
        defaultPaper: 'a5',
        defaultTheme: 'emerald_dz',
        defaultLang: 'ar',
        sourcePage: 'suppliers',
        sourceLabel: 'إدارة الموردين والدفعات',
        proDesc: 'يوثق المبلغ المسدد للمورد من الصندوق، دين المورد قبل الدفعة، والمتبقي مع إمضاء المستلم.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'debt_ledger_box',
          'expense_approval',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'VERS-2026-0022',
          date: '2026-11-19 10:45',
          customerId: 101,
          partyTitle: 'المورد المستفيد:',
          partyName: 'شركة الشرق للتوزيع الغذائي',
          partyPhone: '031887766',
          paymentMethod: 'دفعة نقدية من الصندوق',
          previousBalance: 49000,
          items: [
            { barcode: 'VERS-22', name: 'تسديد دفعة نقدية على حساب فواتير التوريد', unit: 'دفعة', qty: 1, price: 30000, discount: 0, tva: 0, subtotal: 30000 }
          ],
          subtotal: 30000,
          discount: 0,
          total: 30000,
          paidAmount: 30000,
          receivedAmount: 30000,
          remainingDebt: 0,
          customerCurrentTotalDebt: 19000
        }
      },
      {
        id: 'supplier_return_note',
        num: 23,
        cat: 'PURCHASES',
        name: 'سند إرجاع بضاعة للمورد (Retour Fournisseur A4)',
        cleanTitle: 'سند إرجاع بضاعة للمورد / Bon de Retour Fournisseur',
        defaultPaper: 'a4',
        defaultTheme: 'crimson_bold',
        defaultLang: 'ar',
        sourcePage: 'purchases',
        sourceLabel: 'مرتجعات الموردين',
        proDesc: 'يوثق الأصناف المرجعة للمورد وسبب الإرجاع وقيمتها المخصومة من دين المورد أو المستردة نقداً.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'supplier_reception',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'RF-2026-0007',
          date: '2026-11-19 11:30',
          customerId: 101,
          partyTitle: 'المورد المرجعة إليه البضاعة:',
          partyName: 'شركة الشرق للتوزيع الغذائي',
          partyPhone: '031887766',
          paymentMethod: 'خصم من رصيد دين المورد (Avoir)',
          items: [
            { barcode: '6130003000010', name: 'إرجاع: ياغورت الصومام أكتيفيا 110غ (قريب انتهاء الصلاحية)', unit: 'علبة', qty: 40, price: 28, discount: 0, tva: 0, subtotal: 1120 }
          ],
          subtotal: 1120,
          discount: 0,
          total: 1120,
          paidAmount: 1120,
          receivedAmount: 1120,
          remainingDebt: 0
        }
      },
      {
        id: 'supplier_ledger_a4',
        num: 24,
        cat: 'PURCHASES',
        name: 'كشف حساب المورد والفواتير (Relevé Fournisseur A4)',
        cleanTitle: 'كشف حساب مورد مفصل / Relevé de Compte Fournisseur',
        defaultPaper: 'a4',
        defaultTheme: 'royal_blue',
        defaultLang: 'ar',
        sourcePage: 'suppliers',
        sourceLabel: 'إدارة الموردين وكشف الحساب',
        proDesc: 'تقرير A4 شامل يعرض كافة فواتير الشراء ودفعات التسديد والمرتجعات وصافي المستحقات للمورد.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'debt_ledger_box',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'RELF-2026-0009',
          date: '2026-11-19 12:00',
          customerId: 101,
          partyTitle: 'كشف حساب المورد:',
          partyName: 'شركة الشرق للتوزيع الغذائي',
          partyPhone: '031887766',
          paymentMethod: 'كشف حساب شامل للمشتريات والدفعات',
          previousBalance: 0,
          items: [
            { barcode: 'BR-0041', name: 'فاتورة شراء وتوريد رقم #BR-0041', unit: 'فاتورة', qty: 1, price: 84000, discount: 0, tva: 0, subtotal: 84000 },
            { barcode: 'VERS-022', name: 'دفعة تسديد للمورد رقم #VERS-022', unit: 'دفعة (-)', qty: 1, price: -50000, discount: 0, tva: 0, subtotal: -50000 }
          ],
          subtotal: 34000,
          discount: 0,
          total: 34000,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 34000
        }
      },

      // ======================================================================
      // د) المخزون والجرد والتصنيع (4 مستندات: #25 .. #28)
      // ======================================================================
      {
        id: 'stocktake_sheet_a4',
        num: 25,
        cat: 'INVENTORY',
        name: 'محضر الجرد المخزني وفوارق الكميات (Inventaire A4)',
        cleanTitle: "محضر الجرد المخزني الرسمي / Procès-Verbal d'Inventaire",
        defaultPaper: 'a4',
        defaultTheme: 'executive_dark',
        defaultLang: 'ar',
        sourcePage: 'stocktake',
        sourceLabel: 'الجرد المخزني',
        proDesc: 'محضر مطابقة المخزون يعرض الرصيد الدفتري، الرصيد المعدود فعلياً، والفوارق مع توقيع لجنة الجرد.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'stocktake_variance',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'INV-2026-0008',
          date: '2026-11-19 18:00',
          customerId: 1,
          partyTitle: 'نطاق الجرد والمسؤول:',
          partyName: 'المخزن الرئيسي — إشراف: المدير العام',
          paymentMethod: 'محضر جرد وتسوية فوارق المخزون',
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (الدفتري: 25 | المعدود: 25 | الفارق: 0)', unit: 'قارورة', qty: 25, price: 650, discount: 0, tva: 0, subtotal: 16250 },
            { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (الدفتري: 14 | المعدود: 13 | الفارق: -1)', unit: 'علبة', qty: 13, price: 320, discount: 0, tva: 0, subtotal: 4160 }
          ],
          subtotal: 20410,
          discount: 0,
          total: 20410,
          paidAmount: 20410,
          receivedAmount: 20410,
          remainingDebt: 0
        }
      },
      {
        id: 'price_catalog_a4',
        num: 26,
        cat: 'INVENTORY',
        name: 'كتالوج وقائمة أسعار المنتجات (Catalogue des Prix A4)',
        cleanTitle: 'قائمة الأسعار والكتالوج التجاري / Catalogue des Prix',
        defaultPaper: 'a4',
        defaultTheme: 'royal_blue',
        defaultLang: 'ar',
        sourcePage: 'inventory',
        sourceLabel: 'إدارة المخزون وقائمة الأسعار',
        proDesc: 'قائمة أسعار مطبوعة للزبائن والموزعين توضح الباركود والوحدة والسعر المعتمد.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'items_table',
          'bank_rip_ccp',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: false, unitPrice: true, discount: false, tva: false, subtotal: false },
        sampleData: {
          docNumber: 'CAT-2026-02',
          date: '2026-11-19 09:00',
          customerId: 1,
          partyTitle: 'الجهة:',
          partyName: 'قائمة الأسعار الرسمية المعتمدة للزبائن',
          paymentMethod: 'الأسعار بالدينار الجزائري',
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (Elio Cevital)', unit: 'قارورة', qty: 1, price: 650, discount: 0, tva: 0, subtotal: 650 },
            { barcode: '6130002000011', name: 'حليب كانديا نصف دسم 1 لتر (Candia)', unit: 'علبة', qty: 1, price: 150, discount: 0, tva: 0, subtotal: 150 },
            { barcode: '6130006000017', name: 'قهوة مطحونة بونال 250غ (Bonal)', unit: 'علبة', qty: 1, price: 320, discount: 0, tva: 0, subtotal: 320 },
            { barcode: '6130008000022', name: 'كسكس ماما رقيق 1 كغ (Mama)', unit: 'كيس', qty: 1, price: 160, discount: 0, tva: 0, subtotal: 160 }
          ],
          subtotal: 1280,
          discount: 0,
          total: 1280,
          paidAmount: 1280,
          receivedAmount: 1280,
          remainingDebt: 0
        }
      },
      {
        id: 'production_order_sheet',
        num: 27,
        cat: 'INVENTORY',
        name: 'أمر تشغيل وتصنيع داخلي (BOM — A4)',
        cleanTitle: 'أمر تشغيل وتصنيع داخلي / Ordre de Fabrication (BOM)',
        defaultPaper: 'a4',
        defaultTheme: 'emerald_dz',
        defaultLang: 'ar',
        sourcePage: 'manufacturing',
        sourceLabel: 'التصنيع والإنتاج',
        proDesc: 'يوثق وصفة التصنيع، المواد الأولية المسحوبة من المخزن، وتكلفة الوحدة المصنعة الناتجة.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'bom_cost_box',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'PRD-2026-0015',
          date: '2026-11-19 08:00',
          customerId: 1,
          partyTitle: 'ورشة الإنتاج / الوصفة:',
          partyName: 'إنتاج حزمة مواد غذائية مصنعة — دفعة #15',
          paymentMethod: 'أمر إنتاج داخلي معتمد',
          items: [
            { barcode: 'RAW-001', name: 'فرينة ممتازة ماما 1 كغ (سحب من المخزون)', unit: 'كغ', qty: 10, price: 75, discount: 0, tva: 0, subtotal: 750 },
            { barcode: 'RAW-002', name: 'سكر أبيض سيفيتال 1 كغ (سحب من المخزون)', unit: 'كغ', qty: 5, price: 105, discount: 0, tva: 0, subtotal: 525 },
            { barcode: 'RAW-003', name: 'علب ومواد تغليف وتعبئة', unit: 'قطعة', qty: 20, price: 15, discount: 0, tva: 0, subtotal: 300 }
          ],
          subtotal: 1575,
          discount: 0,
          total: 1575,
          paidAmount: 1575,
          receivedAmount: 1575,
          remainingDebt: 0
        }
      },
      {
        id: 'low_stock_order_a4',
        num: 28,
        cat: 'INVENTORY',
        name: 'كشف النواقص المخزنية وطلب التموين (Ruptures A4)',
        cleanTitle: 'كشف النواقص المخزنية وطلب التموين / État des Ruptures',
        defaultPaper: 'a4',
        defaultTheme: 'amber_gold',
        defaultLang: 'ar',
        sourcePage: 'inventory',
        sourceLabel: 'إدارة المخزون والتنبيهات',
        proDesc: 'قائمة الأصناف التي بلغت الحد الأدنى مع الكمية المقترحة للتموين لتسليمها للمورد.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'low_stock_alert',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'RUP-2026-0005',
          date: '2026-11-19 16:00',
          customerId: 1,
          partyTitle: 'موجه إلى قسم:',
          partyName: 'المشتريات والتموين — طلبية تعويض النواقص العاجلة',
          paymentMethod: 'أصناف حرجة تحت الحد الأدنى',
          items: [
            { barcode: '6130001000012', name: 'زيت مائدة إيليو 5 لتر (المتبقي: 2 — الحد الأدنى: 10)', unit: 'قارورة', qty: 24, price: 580, discount: 0, tva: 0, subtotal: 13920 },
            { barcode: '6130005000018', name: 'ماء معدني إيفري 1.5 لتر (المتبقي: 4 — الحد الأدنى: 24)', unit: 'قارورة', qty: 48, price: 36, discount: 0, tva: 0, subtotal: 1728 }
          ],
          subtotal: 15648,
          discount: 0,
          total: 15648,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 15648
        }
      },

      // ======================================================================
      // هـ) الصندوق والورديات والجباية والرقابة (6 مستندات: #29 .. #34)
      // ======================================================================
      {
        id: 'caisse_z_report',
        num: 29,
        cat: 'FINANCE',
        name: 'تذكرة إغلاق الوردية الشاملة (Z-Report 80mm)',
        cleanTitle: 'محضر إغلاق الوردية الشامل (السيولة + الديون + المصاريف) / Z-Report',
        defaultPaper: '80mm',
        defaultTheme: 'executive_dark',
        defaultLang: 'ar',
        sourcePage: 'caisse',
        sourceLabel: 'إدارة الصندوق — إغلاق الوردية ومعاينة Z-Report',
        proDesc: 'تفصل بدقة بين السيولة النقدية المتوقعة في الدرج وبين الديون الآجلة الممنوحة والمصاريف.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'shift_cash_debt_balance',
          'items_table',
          'shift_flows_summary',
          'caisse_billetage',
          'footer_terms'
        ],
        defaultColumns: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'Z-SHIFT-0008',
          date: '2026-11-19 20:00',
          customerId: 1,
          partyTitle: 'الوردية / أمين الصندوق:',
          partyName: 'المناوبة #8 — الكاشير: المدير العام',
          paymentMethod: 'السيولة مطابقة ✔ | ديون الوردية: 270.00 د.ج',
          previousBalance: 270,
          shiftSummary: {
            openingBalance: 8000,
            cashSales: 15800,
            debtPayments: 1200,
            expenses: 1500,
            cashOut: 0,
            expectedBalance: 23500,
            countedBalance: 23500,
            newCreditGiven: 270,
            totalStoreCustomerDebt: 1770
          },
          items: [
            { barcode: '1-OPEN', name: '1. الرصيد الافتتاحي بالدرج (Fond de Caisse)', unit: 'درج', qty: 1, price: 8000, discount: 0, tva: 0, subtotal: 8000 },
            { barcode: '2-CASH', name: '2. المبيعات النقدية والمدفوع جزئياً (+)', unit: 'درج', qty: 1, price: 15800, discount: 0, tva: 0, subtotal: 15800 },
            { barcode: '3-DEBT', name: '3. تحصيلات ديون الزبائن نقداً Alt+V (+)', unit: 'درج', qty: 1, price: 1200, discount: 0, tva: 0, subtotal: 1200 },
            { barcode: '4-EXP', name: '4. المصاريف والسحوبات النقدية (-)', unit: 'درج', qty: 1, price: -1500, discount: 0, tva: 0, subtotal: -1500 }
          ],
          subtotal: 23500,
          discount: 0,
          total: 23500,
          paidAmount: 23500,
          receivedAmount: 23500,
          remainingDebt: 0
        }
      },
      {
        id: 'caisse_shift_full_audit_a4',
        num: 30,
        cat: 'FINANCE',
        name: 'المحضر الرسمي المفصل لإغلاق الوردية والديون (Z-Report A4)',
        cleanTitle: 'المحضر الرسمي المفصل لإغلاق الوردية، السيولة، الديون، والمصاريف (Z-Report A4)',
        defaultPaper: 'a4',
        defaultTheme: 'executive_dark',
        defaultLang: 'ar',
        sourcePage: 'caisse',
        sourceLabel: 'إدارة الصندوق — تقرير الوردية المفصل A4',
        proDesc: 'تقرير A4 محاسبي كامل يفصل السيولة النقدية بالدرج، فواتير الدين بالوردية، التحصيلات، والمصاريف.',
        isNew: true,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'shift_cash_debt_balance',
          'items_table',
          'shift_flows_summary',
          'caisse_billetage',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: true, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'Z-FULL-A4-0008',
          date: '2026-11-19 20:00',
          customerId: 1,
          partyTitle: 'المناوبة / أمين الصندوق:',
          partyName: 'الوردية #8 — الكاشير: المدير العام',
          paymentMethod: 'مطابقة السيولة النقدية + جرد ديون ومصاريف الوردية',
          previousBalance: 270,
          shiftSummary: {
            openingBalance: 8000,
            cashSales: 15800,
            debtPayments: 1200,
            expenses: 1500,
            cashOut: 0,
            expectedBalance: 23500,
            countedBalance: 23500,
            newCreditGiven: 270,
            totalStoreCustomerDebt: 1770
          },
          items: [
            { barcode: '1-OPEN', name: '1. الرصيد النقدي الافتتاحي في الدرج (Fond de Caisse)', unit: 'سيولة درج', qty: 1, price: 8000, discount: 0, tva: 0, subtotal: 8000 },
            { barcode: '2-CASH', name: '2. إجمالي المبيعات النقدية والمدفوع جزئياً (+)', unit: 'سيولة درج', qty: 1, price: 15800, discount: 0, tva: 0, subtotal: 15800 },
            { barcode: '3-DEBT-IN', name: '3. تسديدات الديون المقبوضة نقداً بالوردية Alt+V (+)', unit: 'سيولة درج', qty: 1, price: 1200, discount: 0, tva: 0, subtotal: 1200 },
            { barcode: '4-EXP', name: '4. مصاريف تشغيلية وسحوبات نقدية من الدرج (-)', unit: 'خصم درج', qty: 1, price: -1500, discount: 0, tva: 0, subtotal: -1500 },
            { barcode: '5-CREDIT', name: '5. [ذمم آجلة]: ديون جديدة ممنوحة اليوم للزبائن Alt+D (لا تدخل في كاش الدرج)', unit: 'آجل', qty: 1, price: 270, discount: 0, tva: 0, subtotal: 0 }
          ],
          subtotal: 23500,
          discount: 0,
          total: 23500,
          paidAmount: 23500,
          receivedAmount: 23500,
          remainingDebt: 0
        }
      },
      {
        id: 'caisse_cash_in_voucher_80mm',
        num: 31,
        cat: 'FINANCE',
        name: "سند إيداع وتغذية نقدية في الصندوق (Bon d'Entrée 80mm)",
        cleanTitle: "سند إيداع وتغذية صندوق الكاشير / Bon d'Entrée Caisse",
        defaultPaper: '80mm',
        defaultTheme: 'emerald_dz',
        defaultLang: 'ar',
        sourcePage: 'caisse',
        sourceLabel: 'إدارة الصندوق — إيداع نقدي',
        proDesc: 'وصل حراري لتوثيق المبالغ النقدية المودعة في الدرج (تغذية الصرف أو إيداع مالي) مع التوقيع.',
        isNew: true,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'ENT-2026-0018',
          date: '2026-11-19 08:15',
          customerId: 1,
          partyTitle: 'المودع / أمين الصندوق:',
          partyName: 'تغذية نقدية لصندوق الكاشير — المدير العام',
          paymentMethod: 'إيداع نقدي مباشر في الدرج (+)',
          items: [
            { barcode: 'ENT-18', name: 'إيداع سيولة نقدية لتغذية الصرف في درج الكاشير', unit: 'إيداع', qty: 1, price: 3000, discount: 0, tva: 0, subtotal: 3000 }
          ],
          subtotal: 3000,
          discount: 0,
          total: 3000,
          paidAmount: 3000,
          receivedAmount: 3000,
          remainingDebt: 0
        }
      },
      {
        id: 'expense_voucher',
        num: 32,
        cat: 'FINANCE',
        name: 'سند صرف نقدي / مصروف تشغيلي (Bon de Sortie 80mm)',
        cleanTitle: 'سند صرف نقدي من الصندوق / Bon de Sortie Caisse',
        defaultPaper: '80mm',
        defaultTheme: 'crimson_bold',
        defaultLang: 'ar',
        sourcePage: 'expenses',
        sourceLabel: 'المصاريف ورأس المال + سحب نقدي من الصندوق',
        proDesc: 'وصل إثبات سحب مبلغ نقدي من الدرج لتغطية مصروف تشغيلي مع اعتماد الصرف وتوقيع المستلم.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'items_table',
          'expense_approval',
          'totals_waterfall',
          'footer_terms'
        ],
        defaultColumns: { index: false, barcode: false, name: true, unit: false, qty: false, unitPrice: false, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'EXP-2026-0044',
          date: '2026-11-19 14:00',
          customerId: 1,
          partyTitle: 'فئة المصروف / المستفيد:',
          partyName: 'مصاريف نقل وشحن وتفريغ البضاعة',
          paymentMethod: 'سحب نقدي من مناوبة الصندوق (-)',
          items: [
            { barcode: 'EXP-44', name: 'دفع مصاريف نقل وتفريغ البضاعة (خصم من صندوق الكاشير)', unit: 'سند صرف', qty: 1, price: 1500, discount: 0, tva: 0, subtotal: 1500 }
          ],
          subtotal: 1500,
          discount: 0,
          total: 1500,
          paidAmount: 1500,
          receivedAmount: 1500,
          remainingDebt: 0
        }
      },
      {
        id: 'fiscal_g12_statement',
        num: 33,
        cat: 'FINANCE',
        name: 'استمارة التصريح الجبائي الجزائري (IFU G12 / G50 A4)',
        cleanTitle: 'استمارة التصريح الجبائي الجزائري (IFU G12 / G50)',
        defaultPaper: 'a4',
        defaultTheme: 'emerald_dz',
        defaultLang: 'ar',
        sourcePage: 'analytics',
        sourceLabel: 'الإحصائيات واستوديو الجباية (التبويب 13)',
        proDesc: 'كشف جبائي يفصل رقم أعمال المواد المقننة واسعة الاستهلاك عن السلع العادية الخاضعة لمعدل 5%.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'tax_ifu_g12',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: false, unitPrice: false, discount: false, tva: true, subtotal: true },
        sampleData: {
          docNumber: 'G12-2026-DZ',
          date: '2026-11-19 15:30',
          customerId: 1,
          partyTitle: 'المكلف بالضريبة الجزافية الوحيدة (IFU):',
          partyName: 'Gherbi.Ai POS — تجارة بالتجزئة وسوبرماركت',
          paymentMethod: 'تصريح سنوي IFU G12 (معدل 5%)',
          items: [
            { barcode: 'IFU-REG', name: '1. رقم أعمال المواد المقننة السعر (حليب، سميد، زيت، خبز — هامش الربح الخاضع)', unit: 'مقنن G12', qty: 1, price: 45000, discount: 0, tva: 0, subtotal: 45000 },
            { barcode: 'IFU-5P', name: '2. رقم أعمال السلع التجارية العادية الخاضعة لمعدل 5% (IFU)', unit: 'خاضع 5%', qty: 1, price: 185000, discount: 0, tva: 5, subtotal: 185000 }
          ],
          subtotal: 230000,
          discount: 0,
          total: 230000,
          paidAmount: 230000,
          receivedAmount: 230000,
          remainingDebt: 0
        }
      },
      {
        id: 'forensic_audit_report',
        num: 34,
        cat: 'FINANCE',
        name: 'التقرير الجنائي لرقابة الكاشير وحماية الأرباح (Audit A4)',
        cleanTitle: 'التقرير الجنائي الرسمي لرقابة الكاشير ومنع التلاعب (Anti-Fraude)',
        defaultPaper: 'a4',
        defaultTheme: 'crimson_bold',
        defaultLang: 'ar',
        sourcePage: 'analytics',
        sourceLabel: 'رادار الرقابة الجنائية (التبويب 14) + الدرع العلوي',
        proDesc: 'تقرير رقابي لصاحب المحل يوثق السطور المحذوفة بعد المسح، تفريغ السلة، والبيع بأقل من التكلفة.',
        isNew: false,
        defaultSections: [
          'shop_header',
          'doc_banner',
          'party_box',
          'forensic_radar',
          'items_table',
          'totals_waterfall',
          'dual_signatures',
          'footer_terms'
        ],
        defaultColumns: { index: true, barcode: false, name: true, unit: true, qty: true, unitPrice: true, discount: false, tva: false, subtotal: true },
        sampleData: {
          docNumber: 'AUDIT-2026-14',
          date: '2026-11-19 19:00',
          customerId: 1,
          partyTitle: 'نطاق الفحص الرقابي:',
          partyName: 'جميع البائعين ومناوبات الكاشير',
          paymentMethod: 'تقرير رقابي جنائي لحماية الأرباح',
          items: [
            { barcode: 'VOID-LINE', name: 'حذف سطر من السلة بعد قراءة الباركود (إلغاء قبل التسديد)', unit: 'حركة مرصودة', qty: 2, price: 150, discount: 0, tva: 0, subtotal: 300 },
            { barcode: 'BELOW-COST', name: 'عمليات بيع بسعر التكلفة أو بأقل من سعر الشراء', unit: 'حركة مرصودة', qty: 0, price: 0, discount: 0, tva: 0, subtotal: 0 }
          ],
          subtotal: 300,
          discount: 0,
          total: 300,
          paidAmount: 0,
          receivedAmount: 0,
          remainingDebt: 0
        }
      }
    ];

    PSP.categories = CATEGORIES;
    PSP.templates34 = TEMPLATES_34;
    PSP.modules.templates34 = true;
    PSP.stage = Math.max(PSP.stage || 1, 3);

    if (PSP.state && typeof PSP.state.ensureAllTemplatesInitialized === 'function') {
      PSP.state.ensureAllTemplatesInitialized();
    }
    if (PSP.isPrintViewActive && PSP.isPrintViewActive() && !PSP.modules.ui) {
      PSP.mount();
    }

    console.log('✅ [Print Studio Pro — Stage 3/Templates]: تم تحميل الـ 34 مستنداً افتراضياً (Par Défaut) بالكامل بنجاح 100%.');
  })();
})();
