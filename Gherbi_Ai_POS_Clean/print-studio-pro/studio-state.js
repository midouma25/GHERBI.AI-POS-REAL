/**
 * print-studio-pro/studio-state.js
 * المرحلة 2: مخزن الحالة الموحد (JSON Store + Undo/Redo + SQLite Sync + Zero-Leak Walk-in Guard)
 */
'use strict';
(function buildStudioStateModule() {
  (function initPrintStudioProState() {
    'use strict';

    const PSP = window.GherbiPrintStudioPro;
    if (!PSP) return;

    const STORAGE_KEY = 'gherbi_psp_v1_state';
    const SETTING_KEY = 'gherbi_psp_v1_state';

    const THEMES = {
      executive_dark: {
        id: 'executive_dark',
        name: 'الكحلي التنفيذي الفاخر',
        primary: '#0f172a',
        secondary: '#334155',
        accentBg: '#f8fafc',
        border: '#cbd5e1',
        headerText: '#ffffff'
      },
      royal_blue: {
        id: 'royal_blue',
        name: 'الأزرق الملكي التجاري',
        primary: '#1d4ed8',
        secondary: '#1e3a8a',
        accentBg: '#eff6ff',
        border: '#93c5fd',
        headerText: '#ffffff'
      },
      emerald_dz: {
        id: 'emerald_dz',
        name: 'الأخضر الجزائري الرسمي',
        primary: '#047857',
        secondary: '#064e3b',
        accentBg: '#ecfdf5',
        border: '#6ee7b7',
        headerText: '#ffffff'
      },
      crimson_bold: {
        id: 'crimson_bold',
        name: 'القرمزي للديون والكريدي',
        primary: '#be123c',
        secondary: '#881337',
        accentBg: '#fff1f2',
        border: '#fda4af',
        headerText: '#ffffff'
      },
      amber_gold: {
        id: 'amber_gold',
        name: 'الذهبي للوفاء والتقسيط',
        primary: '#b45309',
        secondary: '#78350f',
        accentBg: '#fffbeb',
        border: '#fcd34d',
        headerText: '#ffffff'
      },
      indigo_pro: {
        id: 'indigo_pro',
        name: 'النيلي المؤسسي الحديث',
        primary: '#4338ca',
        secondary: '#312e81',
        accentBg: '#eef2ff',
        border: '#a5b4fc',
        headerText: '#ffffff'
      },
      pure_mono: {
        id: 'pure_mono',
        name: 'الأسود والأبيض الاقتصادي (توفير الحبر)',
        primary: '#111827',
        secondary: '#374151',
        accentBg: '#ffffff',
        border: '#9ca3af',
        headerText: '#ffffff'
      }
    };

    const SECTIONS_CATALOG = [
      // الأساسية (Core)
      { id: 'shop_header', cat: 'CORE', name: '🏢 ترويسة المتجر والشعار والبيانات الجبائية', desc: 'اسم المتجر، الشعار، الهاتف، العنوان، وأرقام RC / NIF / AI / NIS.' },
      { id: 'doc_banner', cat: 'CORE', name: '🏷️ شريط عنوان ورقم المستند والتاريخ', desc: 'عنوان المستند، الرقم التسلسلي، وتاريخ وساعة الإصدار.' },
      { id: 'party_box', cat: 'CORE', name: '👤 بطاقة الزبون / المورد وكود الوفاء (FID)', desc: 'بيانات الطرف المعني (زبون عابر، زبون وفي FID، أو مورد).' },
      { id: 'items_table', cat: 'CORE', name: '📋 جدول الأصناف والكميات والأسعار', desc: 'جدول ذكي يتكيف تلقائياً مع الحراري 80mm/58mm و A4/A5.' },
      { id: 'totals_waterfall', cat: 'CORE', name: '💰 شلال المجاميع بالدينار والسنتيم والتفقيط', desc: 'المجموع الفرعي، التخفيض، الصافي بالدينار والسنتيم، والمبلغ بالحروف.' },
      { id: 'payment_change', cat: 'CORE', name: '💵 تفصيل المقبوض والصرف المرجع (Rendu)', desc: 'المبلغ المستلم، الصرف المرجع للزبون، طريقة الدفع، واسم الكاشير.' },
      { id: 'footer_terms', cat: 'CORE', name: '✒️ التذييل وشروط الاستبدال ورمز RIP', desc: 'شروط الاستبدال ورمز BaridiMob RIP في أسفل الورقة.' },

      // الديون والوفاء (Credit & Loyalty)
      { id: 'f8_vip_card', cat: 'CREDIT', name: '👑 بطاقة الزبون الوفي: النقاط + الديون (F8)', desc: 'تظهر للزبون الوفي فقط، وتُخفى تلقائياً في تذاكر الزبون العابر.' },
      { id: 'loyalty_points', cat: 'CREDIT', name: '⭐ بطاقة مكافآت واستبدال نقاط الوفاء (F9)', desc: 'تفصل النقاط المكتسبة والمستبدلة والرصيد المتبقي للزبون الوفي.' },
      { id: 'alt_d_credit_box', cat: 'CREDIT', name: '📝 بطاقة تأكيد عملية الدين والمدفوع الجزئي (Alt+D)', desc: 'الدين السابق + فاتورة اليوم - المدفوع = الدين التراكمي الجديد + إمضاء.' },
      { id: 'alt_v_settlement_box', cat: 'CREDIT', name: '💵 بطاقة وصل قبض وتسديد الدين بالسنتيم (Alt+V)', desc: 'الدين قبل التسديد - المبلغ المقبوض = صافي الباقي بالسنتيم.' },
      { id: 'carnet_credit_box', cat: 'CREDIT', name: '🧾 خلاصة كرني الديون الحراري (80mm)', desc: 'ملخص المشتريات والمسدد وصافي الدين المتبقي في ذمة الزبون.' },
      { id: 'debt_ledger_box', cat: 'CREDIT', name: '⚖️ جدول كشف الحساب والرصيد التراكمي (A4/A5)', desc: 'ملخص محاسبي رسمي للرصيد السابق، حركات الفترة، والرصيد النهائي.' },
      { id: 'alt_h_items_history_note', cat: 'CREDIT', name: '📜 بيان هيستوريك السلع المأخوذة بالدين (Alt+H)', desc: 'توضيح تفاصيل السلع المسحوبة في فواتير الدين وتواريخها.' },
      { id: 'installments_box', cat: 'CREDIT', name: '🗓️ جدول الأقساط الشهرية والتسبيق', desc: 'إجمالي العقد، الدفعة الأولى (التسبيق)، عدد الأشهر، والقسط الشهري.' },
      { id: 'bank_rip_ccp', cat: 'CREDIT', name: '🏦 بطاقة الحساب البنكي والبريدي (BaridiMob RIP/CCP)', desc: 'بيانات التحويل البريدي والبنكي للشركات والزبائن.' },

      // الصندوق والورديات والجباية (Caisse & Fiscal)
      { id: 'shift_cash_debt_balance', cat: 'FINANCE', name: '🏦 ميزان الوردية المزدوج: سيولة الدرج مقابل الديون', desc: 'يفصل بدقة بين الكاش الفعلي في الدرج والديون الآجلة الممنوحة (Z-Report).' },
      { id: 'shift_flows_summary', cat: 'FINANCE', name: '💸 ملخص المصاريف والإيداعات وتحصيل الديون بالوردية', desc: 'تفصيل المداخيل النقدية والمصاريف المسحوبة خلال المناوبة.' },
      { id: 'caisse_billetage', cat: 'FINANCE', name: '🔒 جرد الفئات النقدية وفارق الصندوق (Billetage)', desc: 'مطابقة الرصيد المتوقع بالدرج مع المبلغ المعدود والفارق (Écart).' },
      { id: 'shift_owner_radar_alerts', cat: 'FINANCE', name: '🛡️ رادار تنبيهات الرقابة لصاحب المتجر (Z-Report)', desc: 'تنبيهات آلية عند عجز الدرج، الرصيد السالب، تجاوز المصاريف، أو حذف فواتير.' },
      { id: 'shift_outflows_detail', cat: 'FINANCE', name: '💸 دفتر الأموال الخارجة والمصاريف والسلَف (المستفيد + السبب)', desc: 'يعرض من أخذ المال، السبب، الساعة، والمبلغ الخارج من الدرج بالتفصيل.' },
      { id: 'shift_credit_sales_detail', cat: 'FINANCE', name: '📝 دفتر زبائن الكريدي اليوم (الزبائن المدينون بالوردية)', desc: 'أسماء الزبائن الذين أخذوا بالدين اليوم، المدفوع، دين اليوم، ودينهم الكلي الآن.' },
      { id: 'shift_debt_collections_detail', cat: 'FINANCE', name: '🤝 سجل تحصيلات الديون بالوردية (بأسماء الزبائن)', desc: 'تفصيل الديون المقبوضة في الدرج بأسماء الزبائن الحقيقية بدلاً من أرقامها.' },
      { id: 'shift_payment_methods_kpis', cat: 'FINANCE', name: '💳 تفصيل وسائل الدفع ومؤشرات الأداء (Cash/CIB/CCP/آجل)', desc: 'عدد الفواتير، رقم الأعمال، متوسط السلة، التخفيضات، وتقسيم طرق الدفع.' },
      { id: 'shift_top_debtors_followup', cat: 'FINANCE', name: '📌 قائمة أكبر المدينين في المتجر للمتابعة (A4)', desc: 'أكبر الزبائن المدينين حالياً بالهاتف والمبلغ الإجمالي للتحصيل.' },
      { id: 'expense_approval', cat: 'FINANCE', name: '🧾 بطاقة اعتماد سند الصرف وتوقيع المستفيد', desc: 'توثيق فئة المصروف أو الدفعة واسم وتوقيع المستلم.' },
      { id: 'tax_ifu_g12', cat: 'FINANCE', name: '🇩🇿 تفصيل الجباية الجزائرية (IFU G12 / TVA / الطابع)', desc: 'فصل المواد المقننة المعفاة عن السلع العادية الخاضعة لمعدل 5% أو TVA.' },
      { id: 'forensic_radar', cat: 'FINANCE', name: '🛡️ خلاصة الرقابة الجنائية وحماية الأرباح', desc: 'ملخص حركات الحذف بعد المسح والبيع بأقل من التكلفة.' },

      // المخزون والمشتريات واللوجستيك (Inventory & Logistics)
      { id: 'delivery_driver', cat: 'LOGISTICS', name: '🚚 بيانات التوصيل والسائق والمركبة (BL)', desc: 'اسم السائق، رقم لوحة المركبة، الوجهة، وخانة الاستلام.' },
      { id: 'colisage_summary', cat: 'LOGISTICS', name: '📦 ملخص الطرود والكراتين والكميات (Colisage)', desc: 'إجمالي عدد الأصناف وإجمالي عدد القطع والطرود المسلمة.' },
      { id: 'warranty_serial', cat: 'LOGISTICS', name: '🛡️ شهادة الضمان والأرقام التسلسلية (IMEI / S-N)', desc: 'مدة الضمان بالأشهر، الرقم التسلسلي، وشروط الصيانة.' },
      { id: 'order_reservation', cat: 'LOGISTICS', name: '📋 بطاقة حجز الطلبية والعربون (Acompte)', desc: 'توثيق حجز المخزون ومبلغ العربون المدفوع وتاريخ التسليم.' },
      { id: 'supplier_reception', cat: 'LOGISTICS', name: '🛍️ بطاقة مطابقة استلام البضاعة من المورد (BR)', desc: 'توثيق فحص الجودة واستلام البضاعة وإدراجها في المخزون.' },
      { id: 'stocktake_variance', cat: 'LOGISTICS', name: '📊 ملخص محضر الجرد وفوارق الكميات', desc: 'الرصيد الدفتري مقابل الرصيد الفعلي المعدود وقيمة الفارق.' },
      { id: 'bom_cost_box', cat: 'LOGISTICS', name: '🏭 بطاقة تكلفة التصنيع والمواد الأولية (BOM)', desc: 'تفصيل تكلفة المواد الأولية والهدر وتكلفة الوحدة المصنعة.' },
      { id: 'low_stock_alert', cat: 'LOGISTICS', name: '🚨 بطاقة أولوية التموين للأصناف الحرجة', desc: 'عدد الأصناف تحت الحد الأدنى والميزانية التقديرية للتموين.' },

      // إضافية واختيارية (Extras)
      { id: 'return_policy', cat: 'EXTRA', name: '🔄 صندوق شروط الإرجاع والاستبدال', desc: 'توضيح مهلة الاستبدال (48 ساعة) وإلزامية إحضار الوصل الأصلي.' },
      { id: 'vip_coupon', cat: 'EXTRA', name: '✂️ قسيمة هدية وتخفيض قابلة للقص (Coupon)', desc: 'كوبون ترويجي منقط للزيارة القادمة.' },
      { id: 'dual_signatures', cat: 'EXTRA', name: '✍️ مربعات الإمضاء والختم الرسمي', desc: 'خانات توقيع المسلّم / المراقب / المستلم للمستندات الرسمية.' },
      { id: 'custom_note', cat: 'EXTRA', name: '📝 ملاحظة نصية حرة مخصصة', desc: 'صندوق نصي حر يطبع فقط عند كتابة محتوى بداخله.' }
    ];

    const DEFAULT_COLUMN_LABELS = {
      ar: {
        index: '#',
        barcode: 'الباركود',
        name: 'التعيين / الصنف',
        unit: 'الوحدة',
        qty: 'الكمية',
        unitPrice: 'السعر',
        discount: 'الخصم',
        tva: 'TVA',
        subtotal: 'المجموع'
      },
      fr: {
        index: 'N°',
        barcode: 'Code-barres',
        name: 'Désignation',
        unit: 'Unité',
        qty: 'Qté',
        unitPrice: 'P.U',
        discount: 'Rem.',
        tva: 'TVA',
        subtotal: 'Montant'
      },
      en: {
        index: '#',
        barcode: 'Barcode',
        name: 'Item Description',
        unit: 'Unit',
        qty: 'Qty',
        unitPrice: 'Price',
        discount: 'Disc.',
        tva: 'Tax',
        subtotal: 'Total'
      }
    };

    const FALLBACK_DOC_META = {
      id: 'receipt_thermal',
      num: 1,
      cat: 'POS',
      name: 'تذكرة كاشير حرارية شاملة',
      cleanTitle: 'تذكرة مبيعات الكاشير / Ticket de Caisse',
      defaultPaper: '80mm',
      defaultTheme: 'executive_dark',
      sourcePage: 'pos',
      sourceLabel: 'شاشة المبيعات والكاشير (Échap / F1)',
      proDesc: 'تذكرة سوبرماركت حرارية متكاملة تتكيف تلقائياً بين الزبون العابر والزبون الوفي.',
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
      defaultColumns: {
        index: true,
        barcode: false,
        name: true,
        unit: true,
        qty: true,
        unitPrice: true,
        discount: false,
        tva: false,
        subtotal: true
      },
      sampleData: {
        docNumber: 'TIC-2026-0150',
        date: '2026-11-19 17:30',
        customerId: 3,
        partyTitle: 'الزبون الوفي:',
        partyName: '👑 أمين بن يحيى (FID-00003)',
        partyPhone: '0550112233',
        partyAddress: 'قسنطينة — الجزائر',
        paymentMethod: 'نقداً (Espèces)',
        previousBalance: 270,
        loyaltyTotalBalance: 79,
        loyaltyPointsEarned: 3,
        items: [
          { barcode: '6130001000012', name: 'مناديل مبللة ألترا جوي (ULTRA JOY)', unit: 'علبة', qty: 2, price: 75, discount: 0, tva: 0, subtotal: 150 },
          { barcode: '6130002000011', name: 'حفاضات أطفال جوي 72 قطعة', unit: 'كيس', qty: 1, price: 145, discount: 0, tva: 0, subtotal: 145 }
        ],
        subtotal: 295,
        discount: 0,
        total: 295,
        paidAmount: 295,
        receivedAmount: 300,
        remainingDebt: 0
      }
    };

    function deepClone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }

    function fmtDzd(val) {
      return Number(val || 0).toLocaleString('fr-DZ', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' د.ج';
    }

    function getDefaultFooterForDoc(docId) {
      const id = String(docId || 'receipt_thermal');
      const salesDocs = new Set([
        'receipt_thermal', 'invoice_a4', 'invoice_a5', 'invoice_2xa5',
        'debt_confirm_ticket_80mm', 'pos_partial_credit_80mm',
        'credit_note', 'warranty_cert', 'recap_invoice_a4', 'installment_contract'
      ]);
      if (salesDocs.has(id)) {
        return 'البضاعة المباعة لا تُرد ولا تُستبدل إلا خلال 48 ساعة بشرط سلامة الغلاف الأصلي وإحضار الوصل.';
      }
      const receiptAndDebtDocs = new Set([
        'payment_receipt', 'supplier_payment_receipt', 'customer_carnet_80mm',
        'customer_ledger_a4', 'customer_debt_history_a4', 'global_debtors_register_a4',
        'f8_vip_loyalty_debt_card_80mm', 'loyalty_vip_card_80mm', 'supplier_ledger_a4'
      ]);
      if (receiptAndDebtDocs.has(id)) {
        return 'وصل رسمي معتمد — يُحتفظ به كإثبات للدفع وتحديث الرصيد.';
      }
      const financeDocs = new Set([
        'caisse_z_report', 'caisse_shift_full_audit_a4', 'caisse_cash_in_voucher_80mm',
        'expense_voucher', 'fiscal_g12_statement', 'forensic_audit_report'
      ]);
      if (financeDocs.has(id)) {
        return 'وثيقة محاسبية ورقابية رسمية معتمدة — Gherbi.Ai POS.';
      }
      return 'وثيقة تجارية ومخزنية رسمية صادرة عن نظام Gherbi.Ai POS.';
    }

    function fmtCentimes(val) {
      const c = Math.round(Math.abs(Number(val || 0)) * 100);
      if (c === 0) return '0 سنتيم';
      if (c >= 1000000) {
        const m = Math.floor(c / 1000000);
        const remK = Math.floor((c % 1000000) / 1000);
        const mTxt = m === 1 ? 'مليون' : m === 2 ? 'جوج ملاين' : `${m} ملاين`;
        return remK > 0 ? `${mTxt} و ${remK} ألف سنتيم` : `${mTxt} سنتيم`;
      }
      const th = Math.floor(c / 1000);
      const rem = c % 1000;
      if (th === 0) return `${rem} سنتيم`;
      return rem > 0 ? `${th} ألف و ${rem} سنتيم` : `${th} ألف سنتيم`;
    }

    // ========================================================================
    // الحارس الصارم للزبون العابر (Zero-Leak Walk-in Guard)
    // ========================================================================
    function isWalkinCustomerDoc(docData) {
      if (!docData || typeof docData !== 'object') return true;
      if (docData._previewMode === 'WALKIN') return true;
      if (docData._previewMode === 'VIP') return false;

      const cid = Number(docData.customerId || docData.customer_id || 0);
      const pName = String(docData.partyName || docData.customer_name || '').trim();
      const lower = pName.toLowerCase();

      if (cid > 0) return false;
      if (pName.includes('FID-') || pName.includes('👑')) return false;

      if (
        !pName ||
        pName === '-' ||
        pName === 'زبون' ||
        pName.includes('زبون عابر') ||
        lower.includes('comptoir') ||
        lower.includes('walk-in') ||
        lower.includes('passager')
      ) {
        return true;
      }

      if (docData.isWalkinCustomer === true) return true;
      return false;
    }

    function lookupRealCustomer(customerId, partyName) {
      const cid = Number(customerId || 0);
      const debtEng = window.GherbiDebtV68;
      if (cid > 0 && debtEng && debtEng.customersById && debtEng.customersById.has(cid)) {
        return debtEng.customersById.get(cid);
      }
      const appCusts = window.AppState && Array.isArray(window.AppState.customers) ? window.AppState.customers : [];
      if (cid > 0) {
        const found = appCusts.find((c) => Number(c.id) === cid);
        if (found) return found;
      }
      if (partyName) {
        const fidMatch = String(partyName).match(/FID-0*(\d+)/i);
        if (fidMatch && fidMatch[1]) {
          const parsedId = parseInt(fidMatch[1], 10);
          if (debtEng && debtEng.customersById && debtEng.customersById.has(parsedId)) {
            return debtEng.customersById.get(parsedId);
          }
          const found = appCusts.find((c) => Number(c.id) === parsedId);
          if (found) return found;
        }
      }
      return null;
    }

    function normalizeDocData(rawDoc, docTypeHint = '') {
      const d = deepClone(rawDoc && typeof rawDoc === 'object' ? rawDoc : {});
      const docType = String(docTypeHint || d.docType || d._docType || '').trim();
      const items = Array.isArray(d.items) ? d.items : [];

      const textSignals = [
        d.paymentMethod,
        d.partyTitle,
        d.docNumber,
        ...items.map((x) => (x && x.name) || '')
      ].join(' ');

      const isSettlement =
        docType === 'payment_receipt' ||
        docType === 'supplier_payment_receipt' ||
        d._docKind === 'settlement' ||
        /تسديد\s+(دفعة|دين)|استلمنا\s+من|وصل\s+(استلام|قبض)|Reçu de Règlement/i.test(textSignals);

      const isWalkin = isWalkinCustomerDoc(d);
      const calcSub = items.reduce((s, it) => {
        const qty = Number(it.qty ?? it.quantity ?? 1);
        const price = Number(it.price ?? 0);
        const sub = it.subtotal !== undefined ? Number(it.subtotal) : qty * price;
        return s + (Number.isFinite(sub) ? sub : 0);
      }, 0);

      const subtotal = d.subtotal !== undefined ? Number(d.subtotal) : Number(calcSub.toFixed(2));
      const discount = Math.max(0, Number(d.discount || 0));
      const tvaAmount = Math.max(0, Number(d.tvaAmount ?? d.tax_amount ?? 0));
      const stampAmount = Math.max(0, Number(d.stampAmount ?? d.stamp_amount ?? 0));
      const total = d.total !== undefined
        ? Number(d.total)
        : Math.max(0, Number((subtotal - discount + tvaAmount + stampAmount).toFixed(2)));
      const paidAmount = d.paidAmount !== undefined
        ? Number(d.paidAmount)
        : d.paid_amount !== undefined
        ? Number(d.paid_amount)
        : total;
      const receivedAmount = d.receivedAmount !== undefined
        ? Number(d.receivedAmount)
        : d.received_amount !== undefined
        ? Number(d.received_amount)
        : paidAmount;
      const changeAmount = receivedAmount > total ? Number((receivedAmount - total).toFixed(2)) : 0;
      const remainingDebt = d.remainingDebt !== undefined
        ? Math.max(0, Number(d.remainingDebt))
        : Math.max(0, Number((total - paidAmount).toFixed(2)));

      d.items = items;
      d.subtotal = subtotal;
      d.discount = discount;
      d.tvaAmount = tvaAmount;
      d.stampAmount = stampAmount;
      d.total = total;
      d.paidAmount = paidAmount;
      d.receivedAmount = receivedAmount;
      d.changeAmount = changeAmount;
      d.remainingDebt = remainingDebt;
      d.docNumber = d.docNumber || d.doc_number || '101';
      d.date = d.date || d.sale_date || new Date().toISOString().replace('T', ' ').slice(0, 16);
      d.cashierName =
        d.cashierName ||
        d.seller_name ||
        (window.AppState && window.AppState.currentUser && window.AppState.currentUser.name) ||
        'المدير العام';

      if (isWalkin) {
        d.isWalkinCustomer = true;
        d.customerId = null;
        d.partyTitle = d.partyTitle || 'الزبون:';
        d.partyName = 'زبون عابر (Comptoir)';
        d.partyPhone = '';
        d.partyAddress = '';
        d.loyaltyPointsEarned = 0;
        d.loyaltyPointsUsed = 0;
        d.loyaltyTotalBalance = 0;
        d.previousBalance = 0;
        d.customerCurrentTotalDebt = remainingDebt;
        return d;
      }

      d.isWalkinCustomer = false;
      const realCust = d._previewMode
        ? null
        : lookupRealCustomer(d.customerId || d.customer_id, d.partyName || d.customer_name);

      const hasExplicitPrev =
        d.previousBalance !== undefined && d.previousBalance !== null && d.previousBalance !== '';
      const hasExplicitCurr =
        d.customerCurrentTotalDebt !== undefined &&
        d.customerCurrentTotalDebt !== null &&
        d.customerCurrentTotalDebt !== '';

      const cachedDbDebt = realCust ? Math.max(0, Number(realCust.total_debt || 0)) : 0;

      if (realCust) {
        const fid = realCust.loyalty_card_code || ('FID-' + String(realCust.id).padStart(5, '0'));
        const realPts = Math.max(0, Math.floor(Number(realCust.loyalty_points || 0)));

        d.customerId = realCust.id;
        if (!d.partyName || !String(d.partyName).includes(realCust.name)) {
          d.partyName = realCust.name + ' (' + fid + ')';
        }
        if (!d.partyPhone || d.partyPhone === '-') d.partyPhone = realCust.phone || '';
        if (!d.partyAddress || d.partyAddress === '-') d.partyAddress = realCust.address || '';
        if (!d.partyRc) d.partyRc = realCust.rc || '';
        if (!d.partyNif) d.partyNif = realCust.nif || '';

        d.loyaltyTotalBalance =
          d.loyaltyTotalBalance !== undefined && d.loyaltyTotalBalance !== null
            ? Math.max(0, Math.floor(Number(d.loyaltyTotalBalance)))
            : realPts;
        d.loyaltyPointsEarned =
          d.loyaltyPointsEarned !== undefined
            ? Math.max(0, Math.floor(Number(d.loyaltyPointsEarned)))
            : isSettlement
            ? 0
            : Math.max(0, Math.floor(total / 100));
        d.loyaltyPointsUsed = Math.max(0, Math.floor(Number(d.loyaltyPointsUsed || 0)));
      } else {
        d.loyaltyTotalBalance = Math.max(0, Math.floor(Number(d.loyaltyTotalBalance ?? 0)));
        d.loyaltyPointsEarned = Math.max(0, Math.floor(Number(d.loyaltyPointsEarned ?? 0)));
        d.loyaltyPointsUsed = Math.max(0, Math.floor(Number(d.loyaltyPointsUsed ?? 0)));
      }

      if (isSettlement) {
        d._docKind = 'settlement';
        const paidNow = Math.max(0, Number(paidAmount > 0 ? paidAmount : total));
        let debtBefore = hasExplicitPrev ? Math.max(0, Number(d.previousBalance)) : 0;

        if (debtBefore <= 0.009) {
          const joinedTxt = items.map((x) => String((x && x.name) || '')).join(' ');
          const mPrev = joinedTxt.match(/الدين السابق\s*:\s*([0-9]+(?:[.,][0-9]+)?)/);
          if (mPrev && mPrev[1]) {
            debtBefore = Math.max(0, parseFloat(mPrev[1].replace(',', '.')) || 0);
          } else {
            debtBefore = Math.max(paidNow, Number((cachedDbDebt + paidNow).toFixed(2)));
          }
        }

        // المعادلة الصارمة لوصل التسديد: الدين قبل التسديد - المقبوض اليوم = المتبقي (لا يُسمح بالجمع أبداً!)
        const exactAfter = Math.max(0, Number((debtBefore - paidNow).toFixed(2)));
        d.previousBalance = Number(debtBefore.toFixed(2));
        d.paidAmount = Number(paidNow.toFixed(2));
        d.customerCurrentTotalDebt = exactAfter;
        d.remainingDebt = exactAfter;
      } else {
        const freshDbDebt = d._freshDbDebtVerified === true ? Math.max(0, Number(d._freshDbDebt || 0)) : null;
        let prevDebt = 0;
        let finalCurrDebt = 0;

        if (freshDbDebt !== null && remainingDebt > 0.009) {
          // الحقيقة المطلقة من SQLite بعد حفظ الفاتورة: تمنع مضاعفة الدين (370+370=740) إذا مرر المتصل الرصيد بعد الحفظ
          if (freshDbDebt >= remainingDebt - 0.01) {
            finalCurrDebt = Number(freshDbDebt.toFixed(2));
            prevDebt = Math.max(0, Number((finalCurrDebt - remainingDebt).toFixed(2)));
          } else {
            prevDebt = hasExplicitPrev ? Math.max(0, Number(d.previousBalance)) : freshDbDebt;
            finalCurrDebt = Number((prevDebt + remainingDebt).toFixed(2));
          }
        } else {
          if (hasExplicitPrev) {
            prevDebt = Math.max(0, Number(d.previousBalance));
          } else if (realCust) {
            prevDebt =
              cachedDbDebt >= remainingDebt
                ? Math.max(0, Number((cachedDbDebt - remainingDebt).toFixed(2)))
                : Math.max(0, cachedDbDebt);
          }

          const expectedNewDebt = Number((prevDebt + remainingDebt).toFixed(2));
          const explicitCurrVal = hasExplicitCurr ? Math.max(0, Number(d.customerCurrentTotalDebt)) : 0;
          const dbOrExplicit = Math.max(cachedDbDebt, explicitCurrVal);

          finalCurrDebt =
            remainingDebt > 0.009
              ? Math.max(expectedNewDebt, dbOrExplicit)
              : hasExplicitCurr
              ? explicitCurrVal
              : Math.max(prevDebt, cachedDbDebt);
        }

        d.previousBalance = prevDebt;
        d.customerCurrentTotalDebt = finalCurrDebt;
      }

      return d;
    }

    // ========================================================================
    // مخزن الحالة الموحد (StateStore + Undo/Redo + SQLite Sync)
    // ========================================================================
    const StateStore = {
      THEMES,
      SECTIONS_CATALOG,
      DEFAULT_COLUMN_LABELS,
      STORAGE_KEY,
      SETTING_KEY,

      activeView: 'gallery', // 'gallery' | 'studio' | 'barcodes' | 'word_editor'
      activeDocId: 'receipt_thermal',
      activeSidebarTab: 'identity', // 'identity' | 'sections' | 'columns' | 'printer'
      previewMode: 'VIP', // 'WALKIN' | 'VIP' | 'REAL_SALE'
      zoomPct: 100,

      templates: {},
      historyStack: [],
      historyIndex: -1,
      _isRestoring: false,
      _listeners: new Set(),
      _saveTimer: null,
      _hydratedFromDb: false,

      getTemplatesRegistry() {
        if (Array.isArray(PSP.templates34) && PSP.templates34.length > 0) {
          return PSP.templates34;
        }
        return [FALLBACK_DOC_META];
      },

      getDocMeta(docId) {
        const list = this.getTemplatesRegistry();
        const target = docId || this.activeDocId || 'receipt_thermal';
        return list.find((d) => d.id === target) || list[0] || FALLBACK_DOC_META;
      },

      getShopIdentity() {
        const s = (window.AppState && window.AppState.settings) || {};
        return {
          name: s.shop_name || 'Gherbi.Ai POS',
          description: s.shop_description || 'تجارة بالتجزئة وسوبرماركت',
          address: s.shop_address || 'الجزائر',
          phone: s.shop_phone || '',
          email: s.shop_email || '',
          rc: s.shop_rc || '',
          nif: s.shop_nif || '',
          ai: s.shop_ai || '',
          nis: s.shop_nis || '',
          rip: s.shop_baridimob_rip || '',
          ccp: s.shop_ccp || '',
          logo: s.shop_logo || ''
        };
      },

      buildDefaultTemplateConfig(docId) {
        const meta = this.getDocMeta(docId);
        const paper = meta.defaultPaper || '80mm';
        const isThermal = paper === '80mm' || paper === '58mm';
        const defaultSecs = Array.isArray(meta.defaultSections) && meta.defaultSections.length > 0
          ? meta.defaultSections
          : FALLBACK_DOC_META.defaultSections;

        // بناء قائمة الأقسام بالترتيب المثالي للمستند أولاً ثم بقية الأقسام معطلة
        const orderedIds = [
          ...defaultSecs,
          ...SECTIONS_CATALOG.map((s) => s.id).filter((id) => !defaultSecs.includes(id))
        ];

        const sections = orderedIds.map((sid) => {
          const catMeta = SECTIONS_CATALOG.find((x) => x.id === sid);
          return {
            id: sid,
            enabled: defaultSecs.includes(sid),
            title: '',
            note: '',
            align: sid === 'shop_header' || sid === 'doc_banner' || sid === 'footer_terms' ? 'center' : 'right',
            fontScale: 100,
            border: 'default',
            bg: 'default',
            label: catMeta ? catMeta.name : sid
          };
        });

        return {
          id: meta.id,
          paperSize: paper,
          themeId: meta.defaultTheme || 'executive_dark',
          lang: meta.defaultLang || 'ar',
          fontFamily: 'Cairo',
          baseFontSizePx: isThermal ? 11.5 : 12,
          marginMode: 'normal',
          densityMode: isThermal ? 'compact' : 'normal',
          borderMode: isThermal ? 'dashed' : 'grid',
          logoSizePx: isThermal ? 38 : 54,
          logoAlign: 'center',
          showCentimes: true,
          showAmountInWords: !isThermal,
          showFiscalIds: !isThermal,
          showRipFooter: true,
          copies: 1,
          printerName: '',
          customTitle: meta.cleanTitle || meta.name,
          footerText: getDefaultFooterForDoc(meta.id),
          columns: deepClone(meta.defaultColumns || FALLBACK_DOC_META.defaultColumns),
          columnLabels: deepClone(DEFAULT_COLUMN_LABELS[meta.defaultLang || 'ar'] || DEFAULT_COLUMN_LABELS.ar),
          sections,
          shiftOptions: {
            showBeneficiary: true,
            showOutflowTime: true,
            showCustomerPhone: true,
            showCumulativeDebt: true,
            topDebtorsLimit: 5,
            signatureMode: isThermal ? 'dual' : 'triple'
          },
          isCustomized: false
        };
      },

      migrateStoredTemplatesV2() {
        let changed = false;
        for (const [docId, tpl] of Object.entries(this.templates || {})) {
          if (!tpl || typeof tpl !== 'object') continue;
          const idealFooter = getDefaultFooterForDoc(docId);
          const isNonSalesDoc = !idealFooter.includes('البضاعة المباعة');
          if (isNonSalesDoc && tpl.footerText && (tpl.footerText.includes('البضاعة المباعة') || tpl.footerText.includes('48 ساعة'))) {
            tpl.footerText = idealFooter;
            changed = true;
          }
          if (docId === 'payment_receipt' && !tpl._v3SettlementClean && Array.isArray(tpl.sections)) {
            tpl._v3SettlementClean = true;
            tpl.sections.forEach((s) => {
              if (s.id === 'items_table' || s.id === 'totals_waterfall') s.enabled = false;
              if (s.id === 'alt_v_settlement_box' || s.id === 'f8_vip_card') s.enabled = true;
            });
            changed = true;
          }
        }
        if (changed) {
          this.persistLocal();
        }
      },

      ensureAllTemplatesInitialized() {
        /* === [PSP NATIVE Z-REPORT 6 SECTIONS MIGRATION] === */
        const zNewIds80 = ['shift_owner_radar_alerts', 'shift_outflows_detail', 'shift_credit_sales_detail', 'shift_debt_collections_detail', 'shift_payment_methods_kpis', 'dual_signatures'];
        const zNewIdsA4 = ['shift_owner_radar_alerts', 'shift_outflows_detail', 'shift_credit_sales_detail', 'shift_debt_collections_detail', 'shift_payment_methods_kpis', 'shift_top_debtors_followup'];
        const ensureZSections = (docKey, enableIds) => {
          const tpl = this.templates && this.templates[docKey];
          if (!tpl || !Array.isArray(tpl.sections)) return;
          const existingIds = new Set(tpl.sections.map((s) => s.id));
          const missing = SECTIONS_CATALOG.filter((c) => !existingIds.has(c.id));
          if (missing.length === 0) return;
          const footerIdx = tpl.sections.findIndex((s) => s.id === 'footer_terms');
          const insertPos = footerIdx !== -1 ? footerIdx : tpl.sections.length;
          const toInsert = missing.map((catMeta) => ({
            id: catMeta.id,
            enabled: enableIds.includes(catMeta.id),
            title: '',
            note: '',
            align: 'right',
            fontScale: 100,
            border: 'default',
            bg: 'default',
            label: catMeta.name
          }));
          tpl.sections.splice(insertPos, 0, ...toInsert);
        };
        ensureZSections('caisse_z_report', zNewIds80);
        ensureZSections('caisse_shift_full_audit_a4', zNewIdsA4);
        const list = this.getTemplatesRegistry();
        for (const meta of list) {
          if (!this.templates[meta.id]) {
            this.templates[meta.id] = this.buildDefaultTemplateConfig(meta.id);
          } else {
            // دمج أي أقسام جديدة من الكتالوج إذا لم تكن موجودة في النسخة المحفوظة
            const tpl = this.templates[meta.id];
            const existingIds = new Set((tpl.sections || []).map((s) => s.id));
            if (!Array.isArray(tpl.sections)) tpl.sections = [];
            for (const cat of SECTIONS_CATALOG) {
              if (!existingIds.has(cat.id)) {
                tpl.sections.push({
                  id: cat.id,
                  enabled: false,
                  title: '',
                  note: '',
                  align: 'right',
                  fontScale: 100,
                  border: 'default',
                  bg: 'default',
                  label: cat.name
                });
              }
            }
          }
        }
      },

      getTemplate(docId) {
        const id = docId || this.activeDocId || 'receipt_thermal';
        if (!this.templates[id]) {
          this.templates[id] = this.buildDefaultTemplateConfig(id);
        }
        return this.templates[id];
      },

      getActiveTemplate() {
        return this.getTemplate(this.activeDocId);
      },

      // تعديل فوري وآمن على القالب النشط + حفظ في آلة الزمن
      mutateActiveTemplate(mutatorFn, actionLabel = 'تعديل القالب', recordHistory = true) {
        const tpl = this.getActiveTemplate();
        if (recordHistory && this.historyStack.length === 0) {
          this.pushHistory('الحالة الابتدائية');
        }
        mutatorFn(tpl);
        tpl.isCustomized = true;
        if (recordHistory) {
          this.pushHistory(actionLabel);
        }
        this._lastLocalMutateTs = Date.now();
        this.persistLocal();
        this.saveToDatabase(false);
        this.emit('template-changed', { docId: tpl.id, actionLabel });
      },

      resetTemplateToDefault(docId) {
        const targetId = docId || this.activeDocId;
        this.templates[targetId] = this.buildDefaultTemplateConfig(targetId);
        if (targetId === this.activeDocId) {
          this.pushHistory('استعادة الافتراضي (Par Défaut)');
        }
        this.persistLocal();
        this.saveToDatabase(false);
        this.emit('template-reset', { docId: targetId });
      },

      applyStyleToAllTemplates(sourceDocId) {
        const src = this.getTemplate(sourceDocId || this.activeDocId);
        if (!src) return 0;
        const list = this.getTemplatesRegistry();
        const srcIsThermal = src.paperSize === '80mm' || src.paperSize === '58mm';
        let count = 0;
        for (const meta of list) {
          const t = this.getTemplate(meta.id);
          t.themeId = src.themeId;
          t.fontFamily = src.fontFamily;
          t.lang = src.lang;
          t.marginMode = src.marginMode;
          t.densityMode = src.densityMode;
          t.borderMode = src.borderMode;
          t.logoSizePx = src.logoSizePx;
          t.logoAlign = src.logoAlign;
          t.showCentimes = src.showCentimes;
          t.showRipFooter = src.showRipFooter;
          t.columnLabels = deepClone(DEFAULT_COLUMN_LABELS[src.lang] || DEFAULT_COLUMN_LABELS.ar);
          // إذا كان القالب الأصلي والمستهدف كلاهما حرارياً نُعمم المقاس (80mm/58mm) وحجم الخط أيضاً
          const targetIsThermal = (t.paperSize === '80mm' || t.paperSize === '58mm');
          if (srcIsThermal && targetIsThermal) {
            t.paperSize = src.paperSize;
            t.baseFontSizePx = src.baseFontSizePx;
          }
          t.isCustomized = true;
          count++;
        }
        this._lastLocalMutateTs = Date.now();
        this.persistLocal();
        this.saveToDatabase(true);
        this.emit('all-styled', { count });
        return count;
      },

      resetAllTemplatesToDefault() {
        const list = this.getTemplatesRegistry();
        for (const meta of list) {
          this.templates[meta.id] = this.buildDefaultTemplateConfig(meta.id);
        }
        this.historyStack = [];
        this.historyIndex = -1;
        this.pushHistory('اعتماد جميع القوالب الـ 34 الافتراضية');
        this.persistLocal();
        this.saveToDatabase(true);
        this.emit('all-reset', {});
      },

      setActiveDoc(docId) {
        if (!docId) return;
        this.activeDocId = docId;
        this.getTemplate(docId);
        this.historyStack = [];
        this.historyIndex = -1;
        this.pushHistory('فتح المستند');
        this.emit('doc-changed', { docId });
      },

      // آلة الزمن (Undo / Redo)
      pushHistory(label = 'تعديل') {
        if (this._isRestoring) return;
        const tpl = this.getActiveTemplate();
        const serialized = JSON.stringify(tpl);
        if (this.historyIndex >= 0 && this.historyStack[this.historyIndex]?.raw === serialized) {
          return;
        }
        if (this.historyIndex < this.historyStack.length - 1) {
          this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
        }
        this.historyStack.push({
          docId: this.activeDocId,
          label,
          raw: serialized,
          ts: Date.now()
        });
        if (this.historyStack.length > 60) {
          this.historyStack.shift();
        }
        this.historyIndex = this.historyStack.length - 1;
        this.emit('history-changed', this.getHistoryInfo());
      },

      canUndo() {
        return this.historyIndex > 0;
      },

      canRedo() {
        return this.historyIndex >= 0 && this.historyIndex < this.historyStack.length - 1;
      },

      getHistoryInfo() {
        return {
          index: Math.max(0, this.historyIndex),
          total: Math.max(1, this.historyStack.length),
          canUndo: this.canUndo(),
          canRedo: this.canRedo()
        };
      },

      undo() {
        if (!this.canUndo()) return false;
        this._isRestoring = true;
        try {
          this.historyIndex -= 1;
          const snap = this.historyStack[this.historyIndex];
          this.activeDocId = snap.docId;
          this.templates[snap.docId] = JSON.parse(snap.raw);
          this.persistLocal();
          this.emit('history-restored', { direction: 'undo', label: snap.label, docId: snap.docId });
          return true;
        } finally {
          this._isRestoring = false;
        }
      },

      redo() {
        if (!this.canRedo()) return false;
        this._isRestoring = true;
        try {
          this.historyIndex += 1;
          const snap = this.historyStack[this.historyIndex];
          this.activeDocId = snap.docId;
          this.templates[snap.docId] = JSON.parse(snap.raw);
          this.persistLocal();
          this.emit('history-restored', { direction: 'redo', label: snap.label, docId: snap.docId });
          return true;
        } finally {
          this._isRestoring = false;
        }
      },

      // الحفظ المحلي والمزامنة مع SQLite (settings)
      serializePayload() {
        return JSON.stringify({
          schemaVersion: 1,
          updatedAt: new Date().toISOString(),
          templates: this.templates
        });
      },

      persistLocal() {
        try {
          localStorage.setItem(STORAGE_KEY, this.serializePayload());
        } catch (_) {}
      },

      async saveToDatabase(immediate = true) {
        const runSave = async () => {
          const payload = this.serializePayload();
          this.persistLocal();
          try {
            if (window.AppState && window.AppState.settings) {
              window.AppState.settings[SETTING_KEY] = payload;
            }
            if (window.api && typeof window.api.updateSettings === 'function') {
              const receiptTpl = this.templates.receipt_thermal;
              await window.api.updateSettings({
                [SETTING_KEY]: payload,
                receipt_paper_width_mm: receiptTpl && receiptTpl.paperSize === '58mm' ? '58' : '80'
              });
            }
          } catch (e) {
            console.warn('[PSP State DB Save Warning]:', e.message);
          }
        };

        if (immediate) {
          clearTimeout(this._saveTimer);
          await runSave();
        } else {
          clearTimeout(this._saveTimer);
          this._saveTimer = setTimeout(runSave, 400);
        }
      },

      loadFromStorageSync() {
        try {
          const rawDb = window.AppState && window.AppState.settings && window.AppState.settings[SETTING_KEY];
          const rawLs = localStorage.getItem(STORAGE_KEY);
          const chosen = rawDb || rawLs;
          if (chosen) {
            const parsed = JSON.parse(chosen);
            if (parsed && parsed.templates && typeof parsed.templates === 'object') {
              this.templates = parsed.templates;
            }
          }
        } catch (_) {}
        this.ensureAllTemplatesInitialized();
                this.migrateStoredTemplatesV2();
                 this.migrateStoredTemplatesV2();
      },

      async hydrateFromSqlite() {
        if (this._hydratedFromDb) return;
        this._hydratedFromDb = true;
        try {
          if (window.api && typeof window.api.getSettings === 'function') {
            const settings = await window.api.getSettings();
            if (settings && settings[SETTING_KEY]) {
              const parsedDb = JSON.parse(settings[SETTING_KEY]);
              let localUpdatedAt = 0;
              try {
                const rawLs = localStorage.getItem(STORAGE_KEY);
                if (rawLs) {
                  const parsedLs = JSON.parse(rawLs);
                  localUpdatedAt = Date.parse(parsedLs && parsedLs.updatedAt ? parsedLs.updatedAt : '') || 0;
                }
              } catch (_) {}
              const dbUpdatedAt = Date.parse(parsedDb && parsedDb.updatedAt ? parsedDb.updatedAt : '') || 0;

              // لا تسمح لنسخة SQLite الأقدم بمسح التعديلات الأحدث المحفوظة في localStorage
              if (localUpdatedAt > dbUpdatedAt || this._lastLocalMutateTs > 0) {
                await this.saveToDatabase(true);
                return;
              }
              if (parsedDb && parsedDb.templates && typeof parsedDb.templates === 'object') {
                this.templates = { ...this.templates, ...parsedDb.templates };
                this.ensureAllTemplatesInitialized();
                this.migrateStoredTemplatesV2();
                this.persistLocal();
                this.emit('hydrated', {});
              }
            }
          }
        } catch (_) {}
      },

      // نظام الاشتراك التفاعلي الخفيف
      subscribe(fn) {
        if (typeof fn === 'function') this._listeners.add(fn);
        return () => this._listeners.delete(fn);
      },

      emit(eventType, detail) {
        this._listeners.forEach((fn) => {
          try { fn(eventType, detail); } catch (_) {}
        });
      }
    };

    StateStore.loadFromStorageSync();
    setTimeout(() => StateStore.hydrateFromSqlite(), 250);

    PSP.state = StateStore;
    PSP.utils = {
      deepClone,
      fmtDzd,
      fmtCentimes,
      isWalkinCustomerDoc,
      normalizeDocData
    };
    PSP.modules.state = true;
    PSP.stage = Math.max(PSP.stage || 1, 2);

    console.log('✅ [Print Studio Pro — Stage 2/State]: مخزن الحالة الموحد + Undo/Redo + حارس الزبون العابر جاهز 100%.');
  })();
})();

/* === [PSP NATIVE Z-REPORT SHIFT OPTIONS & DOSSIER PRESERVER] === */
(function installPspNativeShiftStateCleanerV2() {
  'use strict';

  const CANONICAL_Z80_ORDER = [
    'shop_header',
    'doc_banner',
    'party_box',
    'shift_cash_debt_balance',
    'shift_flows_summary',
    'shift_owner_alerts',
    'shift_outflows_detail',
    'shift_credit_sales_today',
    'shift_debt_collections',
    'shift_payment_kpis',
    'dual_signatures',
    'footer_terms'
  ];

  const CANONICAL_ZA4_ORDER = [
    'shop_header',
    'doc_banner',
    'party_box',
    'shift_cash_debt_balance',
    'shift_flows_summary',
    'shift_owner_alerts',
    'shift_outflows_detail',
    'shift_credit_sales_today',
    'shift_debt_collections',
    'shift_payment_kpis',
    'shift_top_debtors',
    'totals_waterfall',
    'dual_signatures',
    'footer_terms'
  ];

  const CANONICAL_SHIFT_IDS = new Set([
    'shift_cash_debt_balance',
    'shift_flows_summary',
    'shift_owner_alerts',
    'shift_outflows_detail',
    'shift_credit_sales_today',
    'shift_debt_collections',
    'shift_payment_kpis',
    'shift_top_debtors'
  ]);

  const NEW_SECTIONS_META = {
    shift_owner_alerts: { cat: 'FINANCE', name: '🛡️ رادار تنبيهات الرقابة لصاحب المتجر', desc: 'تنبيهات فورية للعجز، الرصيد السالب، تجاوز المصاريف للكاش، وأحداث الأمان.' },
    shift_outflows_detail: { cat: 'FINANCE', name: '💸 دفتر الأموال الخارجة (المستفيد، السبب، الساعة)', desc: 'يكشف كل مصروف وسلفة وسحب باسم المستفيد والسبب والتوقيت.' },
    shift_credit_sales_today: { cat: 'FINANCE', name: '📝 دفتر زبائن الكريدي اليوم (ديون الوردية)', desc: 'أسماء الزبائن الذين أخذوا بالدين اليوم والمدفوع والدين التراكمي.' },
    shift_debt_collections: { cat: 'FINANCE', name: '🤝 سجل تحصيلات الديون بأسماء الزبائن', desc: 'تفصيل الديون المقبوضة في الدرج بأسماء الزبائن الحقيقية.' },
    shift_payment_kpis: { cat: 'FINANCE', name: '💳 تفصيل وسائل الدفع ومؤشرات الأداء (KPIs)', desc: 'نقداً، CIB/ذهبية، بريدي موب، شيك، آجل، التخفيضات، ومتوسط السلة.' },
    shift_top_debtors: { cat: 'FINANCE', name: '📌 قائمة أكبر المدينين في المتجر للمتابعة غداً', desc: 'أبرز الزبائن المدينين مع أرقام هواتفهم وإجمالي ذمم المتجر.' }
  };

  function defaultShiftOptions(isThermal) {
    return {
      showShiftTimes: true,
      showDrawerCentimes: true,
      showBeneficiary: true,
      showOutflowTime: true,
      showCustomerPhone: true,
      showCumulativeDebt: true,
      showZeroEmptySections: true,
      topDebtorsLimit: 5,
      signatureMode: isThermal ? 'dual' : 'triple'
    };
  }

  function applyStateCleanerV2() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state || PSP.state._nativeShiftCleanerV2) return false;
    PSP.state._nativeShiftCleanerV2 = true;

    const st = PSP.state;

    // 1. تنظيف SECTIONS_CATALOG من أي معرفات shift_ قديمة مكررة، وضمان وجود المعرفات الـ 6 المعتمدة
    if (Array.isArray(st.SECTIONS_CATALOG)) {
      const seenCat = new Set();
      const cleanedCatalog = [];
      for (let i = 0; i < st.SECTIONS_CATALOG.length; i++) {
        const item = st.SECTIONS_CATALOG[i];
        if (!item || !item.id) continue;
        if (item.id.startsWith('shift_') && !CANONICAL_SHIFT_IDS.has(item.id)) continue;
        if (seenCat.has(item.id)) continue;
        seenCat.add(item.id);
        cleanedCatalog.push(item);
      }
      for (const [sid, meta] of Object.entries(NEW_SECTIONS_META)) {
        if (!seenCat.has(sid)) {
          cleanedCatalog.push({ id: sid, cat: meta.cat, name: meta.name, desc: meta.desc });
          seenCat.add(sid);
        }
      }
      st.SECTIONS_CATALOG.length = 0;
      cleanedCatalog.forEach((x) => st.SECTIONS_CATALOG.push(x));
    }

    // 2. دالة إعادة الترتيب الاحترافي النظيف (قابلة للاستدعاء مباشرةً من زر في مركز الطباعة!)
    st.applyIdealZReportOrder = function applyIdealZOrder(tpl) {
      if (!tpl || typeof tpl !== 'object') return tpl;
      const isZ80 = tpl.id === 'caisse_z_report';
      const isZA4 = tpl.id === 'caisse_shift_full_audit_a4';
      if (!isZ80 && !isZA4) return tpl;

      const idealOrder = isZ80 ? CANONICAL_Z80_ORDER : CANONICAL_ZA4_ORDER;
      const byId = new Map();
      const existing = Array.isArray(tpl.sections) ? tpl.sections : [];

      for (let i = 0; i < existing.length; i++) {
        const s = existing[i];
        if (!s || !s.id) continue;
        if (s.id.startsWith('shift_') && !CANONICAL_SHIFT_IDS.has(s.id)) continue;
        if (!byId.has(s.id)) byId.set(s.id, s);
      }

      const catalog = Array.isArray(st.SECTIONS_CATALOG) ? st.SECTIONS_CATALOG : [];
      const rebuilt = [];
      const used = new Set();

      // أولاً: الأقسام المثالية بالترتيب المعتمد ومفعّلة
      for (let i = 0; i < idealOrder.length; i++) {
        const sid = idealOrder[i];
        used.add(sid);
        const old = byId.get(sid);
        const cMeta = catalog.find((c) => c && c.id === sid) || NEW_SECTIONS_META[sid];
        rebuilt.push({
          id: sid,
          enabled: true,
          title: (old && old.title) || '',
          note: (old && old.note) || '',
          align: (old && old.align) || (sid === 'shop_header' || sid === 'doc_banner' || sid === 'footer_terms' ? 'center' : 'right'),
          fontScale: (old && old.fontScale) || 100,
          border: (old && old.border) || 'default',
          bg: (old && old.bg) || 'default',
          label: (cMeta && cMeta.name) || (old && old.label) || sid
        });
      }

      // ثانياً: بقية الأقسام (مثل items_table / caisse_billetage / shift_top_debtors في 80mm) معطلة افتراضياً ولكن متاحة في مركز الطباعة
      for (let i = 0; i < catalog.length; i++) {
        const cMeta = catalog[i];
        if (!cMeta || !cMeta.id || used.has(cMeta.id)) continue;
        if (cMeta.id.startsWith('shift_') && !CANONICAL_SHIFT_IDS.has(cMeta.id)) continue;
        used.add(cMeta.id);
        const old = byId.get(cMeta.id);
        rebuilt.push({
          id: cMeta.id,
          enabled: false,
          title: (old && old.title) || '',
          note: (old && old.note) || '',
          align: (old && old.align) || 'right',
          fontScale: (old && old.fontScale) || 100,
          border: (old && old.border) || 'default',
          bg: (old && old.bg) || 'default',
          label: cMeta.name || cMeta.id
        });
      }

      tpl.sections = rebuilt;
      tpl.shiftOptions = Object.assign(defaultShiftOptions(isZ80), tpl.shiftOptions || {});
      tpl._zCleanV2Migrated = true;
      return tpl;
    };

    // 3. ضمان خلو كل قالب من التكرار وترقية قوالب Z-Report المحفوظة تلقائياً مرة واحدة لـ _zCleanV2Migrated
    st.ensureNativeShiftTemplateUpgraded = function cleanAndUpgradeTemplateV2(tpl) {
      if (!tpl || typeof tpl !== 'object') return tpl;
      const isZ80 = tpl.id === 'caisse_z_report';
      const isZA4 = tpl.id === 'caisse_shift_full_audit_a4';
      const isThermal = tpl.paperSize === '80mm' || tpl.paperSize === '58mm';

      tpl.shiftOptions = Object.assign(defaultShiftOptions(isThermal), tpl.shiftOptions || {});

      if (Array.isArray(tpl.sections)) {
        const seen = new Set();
        tpl.sections = tpl.sections.filter((s) => {
          if (!s || !s.id) return false;
          if (s.id.startsWith('shift_') && !CANONICAL_SHIFT_IDS.has(s.id)) return false;
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
      } else {
        tpl.sections = [];
      }

      if ((isZ80 || isZA4) && !tpl._zCleanV2Migrated) {
        st.applyIdealZReportOrder(tpl);
      } else {
        // التأكد من وجود المعرفات الـ 6 في القائمة حتى لو كان القالب مخصصاً بالفعل
        for (const [sid, meta] of Object.entries(NEW_SECTIONS_META)) {
          if (!tpl.sections.some((s) => s && s.id === sid)) {
            tpl.sections.push({
              id: sid,
              enabled: false,
              title: '',
              note: '',
              align: 'right',
              fontScale: 100,
              border: 'default',
              bg: 'default',
              label: meta.name
            });
          }
        }
      }

      return tpl;
    };

    const origGetTpl = st.getTemplate.bind(st);
    st.getTemplate = function getTemplateCleanedV2(docId) {
      const tpl = origGetTpl(docId);
      return st.ensureNativeShiftTemplateUpgraded(tpl);
    };

    if (typeof st.normalizeDocData === 'function' && !st._normFdPreservedV2) {
      st._normFdPreservedV2 = true;
      const origNorm = st.normalizeDocData.bind(st);
      st.normalizeDocData = function (docId, rawData) {
        const out = origNorm(docId, rawData);
        if (rawData && typeof rawData === 'object') {
          if (rawData.forensicDossier) out.forensicDossier = rawData.forensicDossier;
          if (rawData.shiftSummary) out.shiftSummary = rawData.shiftSummary;
        }
        return out;
      };
    }

    if (st.templates && typeof st.templates === 'object') {
      Object.values(st.templates).forEach((t) => st.ensureNativeShiftTemplateUpgraded(t));
    }

    return true;
  }

  if (!applyStateCleanerV2()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (applyStateCleanerV2() || k >= 40) clearInterval(iv);
    }, 80);
  }
})();

/* === [WAR STAGE 6B2: NATIVE EXPENSE VOUCHERS & OUTFLOWS REPORT STATE] === */
(function installPspNativeExpenseStateV1() {
  'use strict';

  const EXP_DOC_IDS = new Set(['expense_voucher', 'expense_voucher_a4', 'expenses_period_report_a4', 'expenses_period_report_80mm']);
  const EXP_NEW_SECTIONS = {
    expense_voucher_card: { cat: 'FINANCE', name: '🧾 بطاقة سند الصرف التفصيلية (المستفيد + المصدر + السنتيم)', desc: 'تعرض تفاصيل سند الصرف أو السلفة، مصدر المال، المبلغ بالسنتيم وبالحروف، ورقم الوردية.' },
    outflows_report_kpis: { cat: 'FINANCE', name: '📊 بطاقات مؤشرات إجمالي المصاريف والمدفوعات الخارجة', desc: 'إجمالي المصاريف، سلف العمال، تسديدات الموردين، ودفعات المشتريات.' },
    outflows_by_source_box: { cat: 'FINANCE', name: '🏦 توزيع الأموال الخارجة حسب مصادر التمويل الأربعة', desc: 'يفصل ما خرج من درج الوردية، الخزينة الرئيسية، البنك/CCP، والمال الخارجي.' },
    outflows_by_category_box: { cat: 'FINANCE', name: '🗂️ توزيع المصاريف والمدفوعات حسب الفئة والنسبة %', desc: 'يكشف أعلى بنود الصرف ونسبة كل فئة من إجمالي الخارج.' },
    outflows_detail_table: { cat: 'FINANCE', name: '📋 السجل التفصيلي لعمليات الصرف والمدفوعات', desc: 'جدول/قائمة كاملة بجميع السندات مع التاريخ، المستفيد، المصدر، والمبلغ.' }
  };

  function defaultExpOpts(isThermal) {
    return {
      showFundingSource: true,
      showBeneficiary: true,
      showCentimes: true,
      showAmountInWords: !isThermal,
      showShiftRef: true,
      signatureMode: isThermal ? 'dual' : 'triple'
    };
  }

  function applyExpState() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state || PSP.state._nativeExpenseStateV1) return false;
    PSP.state._nativeExpenseStateV1 = true;

    const st = PSP.state;
    if (Array.isArray(st.SECTIONS_CATALOG)) {
      for (const [sid, meta] of Object.entries(EXP_NEW_SECTIONS)) {
        if (!st.SECTIONS_CATALOG.some((x) => x && x.id === sid)) {
          st.SECTIONS_CATALOG.push({ id: sid, cat: meta.cat, name: meta.name, desc: meta.desc });
        }
      }
    }

    const prevGetTpl = st.getTemplate.bind(st);
    st.getTemplate = function getTemplateWithExpenseNative(docId) {
      const tpl = prevGetTpl(docId);
      if (!tpl || typeof tpl !== 'object') return tpl;
      const isThermal = tpl.paperSize === '80mm' || tpl.paperSize === '58mm';
      tpl.expenseOptions = Object.assign(defaultExpOpts(isThermal), tpl.expenseOptions || {});

      if (EXP_DOC_IDS.has(tpl.id)) {
        if (!Array.isArray(tpl.sections)) tpl.sections = [];
        for (const [sid, meta] of Object.entries(EXP_NEW_SECTIONS)) {
          if (!tpl.sections.some((s) => s && s.id === sid)) {
            tpl.sections.push({
              id: sid,
              enabled: false,
              title: '',
              note: '',
              align: 'right',
              fontScale: 100,
              border: 'default',
              bg: 'default',
              label: meta.name
            });
          }
        }

        if (!tpl._expNativeV1Migrated) {
          tpl._expNativeV1Migrated = true;
          const isVoucher = tpl.id === 'expense_voucher' || tpl.id === 'expense_voucher_a4';
          const ideal = isVoucher
            ? ['shop_header', 'doc_banner', 'expense_voucher_card', 'dual_signatures', 'footer_terms']
            : ['shop_header', 'doc_banner', 'outflows_report_kpis', 'outflows_by_source_box', 'outflows_by_category_box', 'outflows_detail_table', 'dual_signatures', 'footer_terms'];

          const byId = new Map();
          tpl.sections.forEach((s) => { if (s && s.id && !byId.has(s.id)) byId.set(s.id, s); });
          const rebuilt = [];
          const used = new Set();
          ideal.forEach((sid) => {
            used.add(sid);
            const old = byId.get(sid);
            const cMeta = (st.SECTIONS_CATALOG || []).find((x) => x && x.id === sid) || EXP_NEW_SECTIONS[sid];
            rebuilt.push({
              id: sid,
              enabled: true,
              title: (old && old.title) || '',
              note: (old && old.note) || '',
              align: sid === 'shop_header' || sid === 'doc_banner' || sid === 'footer_terms' ? 'center' : 'right',
              fontScale: (old && old.fontScale) || 100,
              border: (old && old.border) || 'default',
              bg: (old && old.bg) || 'default',
              label: (cMeta && cMeta.name) || sid
            });
          });
          tpl.sections.forEach((s) => {
            if (s && s.id && !used.has(s.id)) {
              used.add(s.id);
              rebuilt.push(Object.assign({}, s, { enabled: false }));
            }
          });
          tpl.sections = rebuilt;
        }
      }

      return tpl;
    };

    if (typeof st.normalizeDocData === 'function' && !st._normExpPreservedV1) {
      st._normExpPreservedV1 = true;
      const prevNorm = st.normalizeDocData.bind(st);
      st.normalizeDocData = function (docId, rawData) {
        const out = prevNorm(docId, rawData);
        if (rawData && typeof rawData === 'object') {
          if (rawData.expenseVoucher) out.expenseVoucher = rawData.expenseVoucher;
          if (rawData.outflowsReport) out.outflowsReport = rawData.outflowsReport;
        }
        return out;
      };
    }

    if (typeof st.ensureAllTemplatesInitialized === 'function') {
      st.ensureAllTemplatesInitialized();
    }
    return true;
  }

  if (!applyExpState()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (applyExpState() || k >= 40) clearInterval(iv);
    }, 80);
  }
})();

/* === [WAR STAGE 6C: NATIVE Z-REPORT EXTERNAL FUNDING STATE] === */
(function installPspStage6CShiftExternalFundingState() {
  'use strict';

  const Z_IDS = new Set(["receipt_thermal","caisse_z_report","caisse_shift_full_audit_a4","caisse_cash_in_voucher_80mm"]);
  const EXT_SEC_META = {
    id: 'shift_external_funding_box',
    cat: 'FINANCE',
    name: '🏦 المعاملات المموّلة من خارج درج الكاشير (خزينة / بنك / مال خارجي)',
    desc: 'توثّق المدفوعات التي تمّت خلال الوردية من الخزينة الرئيسية أو البنك/CCP أو جيب المالك دون خصمها من الدرج.'
  };

  function applyS6CState() {
    const PSP = window.GherbiPrintStudioPro;
    if (!PSP || !PSP.state || PSP.state._s6cShiftExtStateInstalledV2) return false;
    PSP.state._s6cShiftExtStateInstalledV2 = true;

    const st = PSP.state;
    if (Array.isArray(st.SECTIONS_CATALOG) && !st.SECTIONS_CATALOG.some((x) => x && x.id === EXT_SEC_META.id)) {
      st.SECTIONS_CATALOG.push(EXT_SEC_META);
    }

    const prevGetTpl = st.getTemplate.bind(st);
    st.getTemplate = function getTemplateWithShiftExtFundingV2(docId) {
      const tpl = prevGetTpl(docId);
      if (!tpl || typeof tpl !== 'object') return tpl;

      if (Z_IDS.has(tpl.id) || Z_IDS.has(docId)) {
        if (!tpl.shiftOptions || typeof tpl.shiftOptions !== 'object') tpl.shiftOptions = {};
        if (tpl.shiftOptions.showExternalFundingSection === undefined) {
          tpl.shiftOptions.showExternalFundingSection = true;
        }
        if (!Array.isArray(tpl.sections)) tpl.sections = [];

        let secObj = tpl.sections.find((s) => s && s.id === EXT_SEC_META.id);
        if (!secObj) {
          secObj = {
            id: EXT_SEC_META.id,
            enabled: tpl.shiftOptions.showExternalFundingSection !== false,
            title: '',
            note: '',
            align: 'right',
            fontScale: 100,
            border: 'default',
            bg: 'default',
            label: EXT_SEC_META.name
          };
          const sigIdx = tpl.sections.findIndex((s) => s && (s.id === 'dual_signatures' || s.id === 'footer_terms'));
          if (sigIdx >= 0) tpl.sections.splice(sigIdx, 0, secObj);
          else tpl.sections.push(secObj);
          tpl._s6cExtMigratedV2 = true;
        } else if (!tpl._s6cExtMigratedV2) {
          tpl._s6cExtMigratedV2 = true;
          secObj.enabled = tpl.shiftOptions.showExternalFundingSection !== false;
          secObj.label = EXT_SEC_META.name;
          // وضع القسم قبل التوقيعات مباشرةً ليكون منظماً
          const curIdx = tpl.sections.indexOf(secObj);
          const sigIdx = tpl.sections.findIndex((s) => s && (s.id === 'dual_signatures' || s.id === 'footer_terms'));
          if (sigIdx >= 0 && curIdx > sigIdx) {
            tpl.sections.splice(curIdx, 1);
            tpl.sections.splice(sigIdx, 0, secObj);
          }
        }
      }
      return tpl;
    };

    if (typeof st.normalizeDocData === 'function' && !st._s6cNormPreservedV2) {
      st._s6cNormPreservedV2 = true;
      const prevNorm = st.normalizeDocData.bind(st);
      st.normalizeDocData = function (docId, rawData) {
        const out = prevNorm(docId, rawData);
        if (rawData && typeof rawData === 'object') {
          if (rawData.externalFundedTx) out.externalFundedTx = rawData.externalFundedTx;
          if (rawData.externalFundedTotals) out.externalFundedTotals = rawData.externalFundedTotals;
        }
        return out;
      };
    }

    if (typeof st.ensureAllTemplatesInitialized === 'function') {
      st.ensureAllTemplatesInitialized();
    }
    return true;
  }

  if (!applyS6CState()) {
    let k = 0;
    const iv = setInterval(() => {
      k++;
      if (applyS6CState() || k >= 40) clearInterval(iv);
    }, 80);
  }
})();
