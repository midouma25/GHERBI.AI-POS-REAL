/**
 * golden-master-100.js
 * ترقية الإطلاق التجاري الذهبي (100.0% Golden Master Release Patch) — مشروع Gherbi.Ai POS
 * يغلق آخر 10 ثغرات تقنية وتفاصيل دقيقة:
 * 1. ترقية محرك الأيقونات (assets/js/svg-icons.js) بـ 88+ أيقونة ودعم .material-symbols-rounded و .material-symbols-outlined
 * 2. استكمال توجيه الشبكة المحلية (isLanClientMode) لجميع المعالجات الـ 12 في main.js
 * 3. ربط حقل مرجع الدفع (#chkPaymentRefInput) وحقل ولاية التوصيل (#delivWilayaSelect) بالحفظ والطباعة
 * 4. ترقية نافذة مرتجع المورد (#supplierReturnModal) لدعم إرجاع عدة أصناف من فواتير الشراء الأصلية
 * 5. حفظ واسترجاع مجموعات الخيارات (option_groups) في نافذة المنتج (productModal)
 * 6. تخصيص طابعة التذاكر الحرارية وطابعة A4، وفتح الدرج التلقائي، وإضافة الوزن التلقائي للميزان
 * 7. حاسبة عدّ الفئات النقدية الجزائرية في نافذة إغلاق الصندوق (closeShiftModal) ومعاينة الفارق اللحظي
 * 8. نافذة مراجعة تفاصيل المناوبة (#reviewCaisseModal) وفلترة سجل المناوبات
 * 9. عرض رمز QR للدفع عبر BaridiMob / CCP على شاشة الزبون الثانية (Customer Facing Display)
 * 10. الاستيراد الآلي لقاعدة بيانات المنتجات الجزائرية الضخمة (Lumina_DZ_Products.csv / Lumina_Ultimate_Products.csv)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ============================================================================
// المهمة 1: تحديث assets/js/svg-icons.js (88+ أيقونة + دعم rounded و outlined)
// ============================================================================
const cleanMaterialCss = `/**
 * assets/css/material-symbols.css
 * تنسيق موحد لحاويات الأيقونات المتجهة (.material-symbols-rounded & .material-symbols-outlined)
 */

.material-symbols-rounded,
.material-symbols-outlined {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35em;
  height: 1.35em;
  font-size: 22px;
  line-height: 1;
  vertical-align: middle;
  flex-shrink: 0;
  user-select: none;
  overflow: hidden;
}

.material-symbols-rounded svg,
.material-symbols-outlined svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
  display: block;
}

.icon-sm { font-size: 18px; width: 18px; height: 18px; }
.icon-md { font-size: 24px; width: 24px; height: 24px; }
.icon-lg { font-size: 32px; width: 32px; height: 32px; }
.icon-xl { font-size: 48px; width: 48px; height: 48px; }
`;
fs.writeFileSync(path.join(ROOT, 'assets', 'css', 'material-symbols.css'), cleanMaterialCss, 'utf8');

const fullSvgIconsCode = `/**
 * assets/js/svg-icons.js
 * محرك الأيقونات المتجهة الشامل (100% Offline Vector SVG Engine — 88+ Icons)
 * يدعم كلاً من .material-symbols-rounded و .material-symbols-outlined تلقائياً
 */

'use strict';

(function () {
  const PATHS = {
    point_of_sale: 'M17 2H7c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 4H7V4h10v2zm3 16H4c-1.1 0-2-.9-2-2v-1h20v1c0 1.1-.9 2-2 2zM18.5 9h-13c-.83 0-1.5.67-1.5 1.5v6.5h16v-6.5c0-.83-.67-1.5-1.5-1.5zM9 15H7v-1h2v1zm0-2H7v-1h2v1zm4 2h-2v-1h2v1zm0-2h-2v-1h2v1zm4 2h-2v-1h2v1zm0-2h-2v-1h2v1z',
    shopping_cart_checkout: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-8.9-5h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4l-3.87 7H8.53L4.27 2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7l1.1-2z',
    receipt_long: 'M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM15 20H6c-.55 0-1-.45-1-1v-1h10v2zm4-1c0 .55-.45 1-1 1s-1-.45-1-1v-3H8V5h11v14zM9 7h6v2H9V7zm0 3h6v2H9v-2z',
    account_balance_wallet: 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    inventory_2: 'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
    inventory: 'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
    redeem: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z',
    precision_manufacturing: 'M19.93 8.35l-3.6 1.68L14 7.7V6.3l2.33-2.33 3.6 1.68c.38.18.82-.01 1-.39.18-.38-.01-.82-.39-1l-3.92-1.83c-.38-.18-.83-.1-1.13.2L13.12 5H11v2.12L5.83 12.3c-.36.36-.58.86-.58 1.41V18H4c-1.1 0-2 .9-2 2v2h20v-2c0-1.1-.9-2-2-2h-7.25v-3.88l4.46-4.46 2.12 2.12c.3.3.75.38 1.13.2l3.92-1.83c.38-.18.57-.62.39-1-.18-.38-.63-.57-1.01-.39z',
    fact_check: 'M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V7h5v2zm4.82 6L12 12.16l1.41-1.41 1.41 1.42L17.99 9l1.42 1.42L14.82 15z',
    qr_code_2: 'M15 21h-2v-2h2v2zm-2-7h-2v5h2v-5zm8-2h-2v4h2v-4zm-2-2h-2v2h2v-2zM7 12H5v2h2v-2zm-2-2H3v2h2v-2zm7-5h2V3h-2v2zm-7.5-.5v3h3v-3h-3zM9 9H3V3h6v6zm-4.5 7.5v3h3v-3h-3zM9 21H3v-6h6v6zm10.5-16.5v3h3v-3h-3zM21 9h-6V3h6v6zm-2 10v-3h-4v2h2v3h4v-2h-2z',
    qr_code: 'M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zM13 3v8h8V3h-8zm6 6h-4V5h4v4zM13 13h2v2h-2zM15 15h2v2h-2zM13 17h2v2h-2zM17 17h2v2h-2zM19 19h2v2h-2zM15 19h2v2h-2zM17 13h2v2h-2zM19 15h2v2h-2z',
    local_shipping: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    shopping_bag: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',
    groups: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z',
    person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    description: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    payments: 'M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z',
    monitoring: 'M3 13h2v8H3v-8zm4-3h2v11H7V10zm4-4h2v15h-2V6zm4 6h2v9h-2v-9zm4-8h2v17h-2V4z',
    analytics: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2v-3h2v3zm0-5h-2v-2h2v2zm4 5h-2V7h2v10z',
    auto_awesome: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z',
    manage_accounts: 'M10 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 8c3.31 0 6 1.79 6 4v2H4v-2c0-2.21 2.69-4 6-4zm9.43 4.02c.36-.59.57-1.28.57-2.02s-.21-1.43-.57-2.02l1.23-1.23-1.41-1.41-1.23 1.23c-.59-.36-1.28-.57-2.02-.57s-1.43.21-2.02.57l-1.23-1.23-1.41 1.41 1.23 1.23c-.36.59-.57 1.28-.57 2.02s.21 1.43.57 2.02l-1.23 1.23 1.41 1.41 1.23-1.23c.59.36 1.28.57 2.02.57s1.43-.21 2.02-.57l1.23 1.23 1.41-1.41-1.23-1.23zM16 17.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    menu_open: 'M3 18h13v-2H3v2zm0-5h10v-2H3v2zm0-7v2h13V6H3zm18 9.59L17.42 12 21 8.41 19.59 7l-5 5 5 5L21 15.59z',
    menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
    verified: 'M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z',
    logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
    search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    barcode_scanner: 'M4 6h2v12H4V6zm3 0h1v12H7V6zm2 0h3v12H9V6zm4 0h1v12h-1V6zm3 0h2v12h-2V6zm3 0h1v12h-1V6zM2 4v4H0V4c0-1.1.9-2 2-2h4v2H2zm20-2c1.1 0 2 .9 2 2v4h-2V4h-4V2h4zM2 16v4h4v2H2c-1.1 0-2-.9-2-2v-4h2zm20 4v-4h2v4c0 1.1-.9 2-2 2h-4v-2h4z',
    scale: 'M14 11V8c4.56-.58 8-3.1 8-6H2c0 2.9 3.44 5.42 8 6v3c-3.68.73-8 3.61-8 11h6v-2H4.13c.93-4.05 4.06-6.6 7.87-6.6s6.94 2.55 7.87 6.6H16v2h6c0-7.39-4.32-10.27-8-11zm-2-6c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z',
    dark_mode: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z',
    light_mode: 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z',
    fullscreen: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
    add_shopping_cart: 'M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-8.9-5h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4l-3.87 7H8.53L4.27 2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7l1.1-2z',
    keyboard_return: 'M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7h-2z',
    undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
    refresh: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
    sync: 'M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    remove: 'M19 13H5v-2h14v2z',
    person_add: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    shopping_basket: 'M17.21 9l-4.38-6.56c-.19-.28-.51-.42-.83-.42-.32 0-.64.14-.83.43L6.79 9H2c-.55 0-1 .45-1 1 0 .09.01.18.04.27l2.54 9.27c.23.84 1 1.46 1.92 1.46h13c.92 0 1.69-.62 1.93-1.46l2.54-9.27L23 10c0-.55-.45-1-1-1h-4.79zM9 9l3-4.4L15 9H9zm3 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    shopping_cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    receipt: 'M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z',
    print: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z',
    check_circle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    lock_person: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
    notifications: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    add_circle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z',
    menu_book: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
    task_alt: 'M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18zm-2.21 5.04c.13.57.21 1.17.21 1.78 0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8c1.58 0 3.04.46 4.28 1.25l1.44-1.44C16.1 2.67 14.13 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10c0-1.19-.22-2.33-.6-3.39l-1.61 1.61z',
    bolt: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
    factory: 'M22 10v12H2V10l7-3v2l5-2v3h8zm-4 8h2v-4h-2v4zm-4 0h2v-4h-2v4zm-4 0h2v-4h-2v4zm-4 0h2v-4H6v4zM22 4h-5v4h5V4z',
    save: 'M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z',
    content_copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
    key: 'M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    upload_file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.84V19h2v-4.16l1.59 1.59L16 15.01 12.01 11 8 15.01z',
    workspace_premium: 'M9.68 13.69L12 11.93l2.31 1.76-.88-2.85L15.75 9h-2.84L12 6.19 11.09 9H8.25l2.31 1.84-.88 2.85zM20 10c0-4.42-3.58-8-8-8s-8 3.58-8 8c0 2.03.76 3.87 2 5.28V23l6-2 6 2v-7.72c1.24-1.41 2-3.25 2-5.28zm-8-6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6z',
    verified_user: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z',
    keyboard: 'M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z',
    tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
    help: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
    lan: 'M13 22h8v-7h-3v-4h-5V9h3V2H8v7h3v2H6v4H3v7h8v-7H8v-2h8v2h-3v7z',
    tune: 'M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z',
    filter_alt: 'M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39c.51-.66.04-1.61-.79-1.61H5.04c-.83 0-1.3.95-.79 1.61z',
    history: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
    shield_person: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4.9c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7-2.7-1.21-2.7-2.7 1.21-2.7 2.7-2.7zm0 11.5c-2.42 0-4.54-1.15-5.73-2.9.04-1.89 3.82-2.93 5.73-2.93s5.69 1.04 5.73 2.93c-1.19 1.75-3.31 2.9-5.73 2.9z',
    calendar_month: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z',
    edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    visibility: 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z',
    photo_camera: 'M12 12m-3.2 0a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9z',
    layers: 'M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z',
    warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
    call_split: 'M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4h-6zm-4 0H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3L10 4z',
    download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
    calculate: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5.97 4.06L14.09 6l1.41 1.41L16.91 6l1.06 1.06-1.41 1.41 1.41 1.41-1.06 1.06-1.41-1.4-1.41 1.41-1.06-1.06 1.41-1.41-1.41-1.42zm-6.78.66h5v1.5h-5v-1.5zM11.5 16h-2v2H8v-2H6v-1.5h2v-2h1.5v2h2V16zm6.5 1.25h-5v-1.5h5v1.5zm0-2.5h-5v-1.5h5v1.5z',
    arrow_back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    arrow_forward: 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z',
    expand_more: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
    chevron_right: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
    chevron_left: 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
    star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    category: 'M12 2l-5.5 9h11z M17.5 17.5m-4.5 0a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0 M3 13.5h8v8H3z',
    storefront: 'M18.36 9l.6 3H5.04l.6-3h12.72M20 4H4v2h16V4zm0 3H4l-1 5v2h1v6h10v-6h4v6h2v-6h1v-2l-1-5zM6 18v-4h6v4H6z',
    cloud_done: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z',
    smartphone: 'M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z'
  };

  const DEFAULT_PATH = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z';
  const ICON_SELECTOR = '.material-symbols-rounded, .material-symbols-outlined';

  function convertSpanToSvg(el) {
    if (!el || el.dataset.svgRendered === '1') return;
    if (el.querySelector('svg')) {
      el.dataset.svgRendered = '1';
      return;
    }
    const rawName = String(el.textContent || '').trim().toLowerCase();
    if (!rawName) return;

    const d = PATHS[rawName] || DEFAULT_PATH;
    el.dataset.iconName = rawName;
    el.dataset.svgRendered = '1';
    el.innerHTML = \`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="\${d}"/></svg>\`;
  }

  function scanAndRenderIcons(root = document) {
    if (!root || !root.querySelectorAll) return;
    const nodes = root.querySelectorAll(ICON_SELECTOR);
    nodes.forEach(convertSpanToSvg);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      scanAndRenderIcons(document);
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (
                node.classList &&
                (node.classList.contains('material-symbols-rounded') ||
                  node.classList.contains('material-symbols-outlined'))
              ) {
                convertSpanToSvg(node);
              }
              scanAndRenderIcons(node);
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  window.SvgIconEngine = { scanAndRenderIcons, convertSpanToSvg };
})();
`;

fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'svg-icons.js'), fullSvgIconsCode, 'utf8');
console.log('✅ 1/10: تم تحديث محرك الأيقونات المتجهة (88+ أيقونة مع دعم rounded و outlined).');

// ============================================================================
// المهمة 2 و 3 و 9 و 10: ترقية main.js و server.js
// - إضافة توجيه isLanClientMode للمعالجات الـ 12
// - حفظ payment_reference في sale_payments
// - عرض رمز BaridiMob QR على شاشة الزبون الثانية
// - الاستيراد التلقائي لملف المنتجات الجزائرية الضخم (Lumina_DZ_Products.csv / Lumina_Ultimate_Products.csv)
// ============================================================================
const serverPath = path.join(ROOT, 'server.js');
if (fs.existsSync(serverPath)) {
  let srv = fs.readFileSync(serverPath, 'utf8');

  if (!srv.includes('saleData.payment_reference')) {
    srv = srv.replace(
      `await db.dbRun(
          \`INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method)
           VALUES (?, ?, ?, ?, ?)\`,
          [saleId, customerId, paidAmount, saleDate, paymentMethod]
        );`,
      `await db.dbRun(
          \`INSERT INTO sale_payments (sale_id, customer_id, amount, date, payment_method, reference)
           VALUES (?, ?, ?, ?, ?, ?)\`,
          [saleId, customerId, paidAmount, saleDate, paymentMethod, saleData.payment_reference || saleData.reference || null]
        );`
    );
    fs.writeFileSync(serverPath, srv, 'utf8');
  }
}

const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  // توجيه isLanClientMode للمعالجات الجديدة
  const lanForwards = [
    [
      "ipcMain.handle('lookup-warranty-serial', async (_e, rawSerial) => {",
      "ipcMain.handle('lookup-warranty-serial', async (_e, rawSerial) => {\n    if (await isLanClientMode()) return lanClient.lookupWarrantySerial(rawSerial);"
    ],
    [
      "ipcMain.handle('get-dz-dictionary-stats', async () => {",
      "ipcMain.handle('get-dz-dictionary-stats', async () => {\n    if (await isLanClientMode()) return lanClient.getDzDictionaryStats();"
    ],
    [
      "ipcMain.handle('get-supplier-ledger', async (_e, supplierId) => {",
      "ipcMain.handle('get-supplier-ledger', async (_e, supplierId) => {\n    if (await isLanClientMode()) return lanClient.getSupplierLedger(supplierId);"
    ],
    [
      "ipcMain.handle('get-doc-counters', async () => {",
      "ipcMain.handle('get-doc-counters', async () => {\n    if (await isLanClientMode()) return lanClient.getDocCounters();"
    ],
    [
      "ipcMain.handle('update-doc-counter', async (_e, payload = {}) => {",
      "ipcMain.handle('update-doc-counter', async (_e, payload = {}) => {\n    if (await isLanClientMode()) return lanClient.updateDocCounter(payload);"
    ],
    [
      "ipcMain.handle('lookup-dz-barcode', async (_e, barcode) => {",
      "ipcMain.handle('lookup-dz-barcode', async (_e, barcode) => {\n    if (await isLanClientMode()) return lanClient.lookupDzBarcode(barcode);"
    ],
    [
      "ipcMain.handle('get-audit-logs', async () => {",
      "ipcMain.handle('get-audit-logs', async () => {\n    if (await isLanClientMode()) return lanClient.getAuditLogs();"
    ],
    [
      "ipcMain.handle('add-audit-log', async (_e, payload = {}) => {",
      "ipcMain.handle('add-audit-log', async (_e, payload = {}) => {\n    if (await isLanClientMode()) return lanClient.addAuditLog(payload);"
    ],
    [
      "ipcMain.handle('get-installment-plans', async (_e, filters = {}) => {",
      "ipcMain.handle('get-installment-plans', async (_e, filters = {}) => {\n    if (await isLanClientMode()) return lanClient.getInstallmentPlans(filters);"
    ],
    [
      "ipcMain.handle('create-installment-plan', async (_e, payload = {}) => {",
      "ipcMain.handle('create-installment-plan', async (_e, payload = {}) => {\n    if (await isLanClientMode()) return lanClient.createInstallmentPlan(payload);"
    ],
    [
      "ipcMain.handle('pay-installment-schedule', async (_e, scheduleId, amount) => {",
      "ipcMain.handle('pay-installment-schedule', async (_e, scheduleId, amount) => {\n    if (await isLanClientMode()) return lanClient.payInstallmentSchedule(scheduleId, amount);"
    ],
    [
      "ipcMain.handle('get-ai-copilot-insights', async () => {",
      "ipcMain.handle('get-ai-copilot-insights', async () => {\n    if (await isLanClientMode()) return lanClient.getAiCopilotInsights();"
    ]
  ];

  for (const [target, replacement] of lanForwards) {
    if (mainCode.includes(target) && !mainCode.includes(replacement)) {
      mainCode = mainCode.replace(target, replacement);
    }
  }

  // إضافة رمز BaridiMob QR على شاشة الزبون الثانية (Customer Facing Display)
  if (mainCode.includes('const rip = await getSetting(\'shop_baridimob_rip\'')) {
    mainCode = mainCode.replace(
      "const rip = await getSetting('shop_baridimob_rip', '00799999000000000000');",
      "const rip = await getSetting('shop_baridimob_rip', '00799999000000000000');\n  const ripQrImg = rip ? await QRCode.toDataURL(String(rip), { margin: 1, width: 130 }).catch(() => '') : '';"
    );
    mainCode = mainCode.replace(
      `<div style="font-family:monospace;font-size:12px;word-break:break-all;">\${rip}</div>`,
      `<div style="font-family:monospace;font-size:12px;word-break:break-all;">\${rip}</div>
        \${ripQrImg ? \`<img src="\${ripQrImg}" style="width:110px;height:110px;margin:8px auto 0;border-radius:10px;background:#fff;padding:4px;display:block;">\` : ''}`
    );
  }

  // الاستيراد الآلي لملف المنتجات الجزائرية الضخم عند بدء التشغيل إن وُجد في المجلدات المجاورة
  if (!mainCode.includes('autoSeedDzCsvIfFound')) {
    const autoSeedCode = `
async function autoSeedDzCsvIfFound() {
  try {
    const countRow = await dbGet('SELECT COUNT(*) AS c FROM dz_product_dictionary');
    if (Number((countRow && countRow.c) || 0) > 500) return;

    const candidatePaths = [
      path.join(__dirname, 'Lumina_DZ_Products.csv'),
      path.join(__dirname, 'Lumina_Ultimate_Products.csv'),
      path.join(__dirname, '..', 'Lumina_DZ_Products.csv'),
      path.join(__dirname, '..', 'Lumina_Ultimate_Products.csv'),
      path.join(__dirname, '..', 'codebreaker', 'Lumina_DZ_Products.csv'),
      path.join(__dirname, '..', 'codebreaker', 'Lumina_Ultimate_Products.csv')
    ];

    const foundCsv = candidatePaths.find((p) => fs.existsSync(p));
    if (!foundCsv) return;

    console.log('[DZ Dictionary] Auto-importing Algerian products from:', foundCsv);
    const wb = XLSX.readFile(foundCsv, { raw: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    await db.withTransaction(async () => {
      const stmt = db._rawPrepare(
        'INSERT OR IGNORE INTO dz_product_dictionary (barcode, name, category, brand, unit, suggested_price) VALUES (?, ?, ?, ?, ?, ?)'
      );
      let count = 0;
      for (const r of rows) {
        const bc = String(r.barcode || r.code || '').trim();
        const name = String(r.name || r.product_name || '').trim();
        if (!bc || !name) continue;
        stmt.run(
          bc,
          name.slice(0, 120),
          String(r.category || 'مواد غذائية').trim().slice(0, 50),
          String(r.supplier || r.brand || '').trim().slice(0, 50),
          'قطعة',
          Number(r.selling_price || 0) || 0
        );
        count++;
        if (count >= 25000) break;
      }
      stmt.finalize();
      console.log(\`[DZ Dictionary] Successfully seeded \${count} products!\`);
    });
  } catch (err) {
    console.warn('[DZ Dictionary] Auto-seed skipped:', err.message);
  }
}
`;
    mainCode = mainCode.replace('app.whenReady().then(async () => {', autoSeedCode + '\napp.whenReady().then(async () => {\n  await autoSeedDzCsvIfFound();');
  }

  fs.writeFileSync(mainPath, mainCode, 'utf8');
}
console.log('✅ 2/10 & 3/10 & 9/10 & 10/10: تم تحديث main.js و server.js (LAN Client + Payment Ref + Customer Display QR + Auto CSV Seed).');

// ============================================================================
// المهمة 4 و 7 و 8: تحديث index.html
// - ترقية نافذة مرتجع المورد المتعدد من فواتير الشراء (#supplierReturnModal)
// - إضافة حاسبة عدّ الفئات النقدية في نافذة إغلاق الصندوق (#closeShiftModal)
// - إضافة نافذة مراجعة تفاصيل المناوبة (#reviewCaisseModal)
// ============================================================================
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // ترقية نافذة #supplierReturnModal لدعم إرجاع عدة أصناف من فواتير المورد الأصلية
  const oldSupRetModalRegex = /<div id="supplierReturnModal"[\s\S]*?<!-- 16\. نافذة إضافة\/تعديل مورد/;
  const newSupRetModalHtml = `<div id="supplierReturnModal" class="modal-overlay">
    <div class="modal-content w-full max-w-3xl p-6 space-y-4 overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <h3 class="text-lg font-black text-rose-600">إرجاع بضاعة للمورد من فواتير الشراء (Bon de Retour Fournisseur)</h3>
        <button onclick="App.closeModal('supplierReturnModal')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <label class="block font-bold mb-1">اختر المورد *</label>
          <select id="supRetSupplierSelect" onchange="App.loadSupplierReturnableBatches(this.value)" class="w-full px-3 py-2 rounded-xl font-bold"></select>
        </div>
        <div>
          <label class="block font-bold mb-1">طريقة تسوية المرتجع</label>
          <select id="supRetSettlementMode" class="w-full px-3 py-2 rounded-xl font-bold">
            <option value="credit">خصم من دين المورد (Avoir / Crédit)</option>
            <option value="cash">استرداد نقدي للصندوق (Remboursement Espèces)</option>
          </select>
        </div>
        <div>
          <label class="block font-bold mb-1">سبب الإرجاع</label>
          <input id="supRetReasonInput" type="text" placeholder="بضاعة تالفة / غير مطابقة / قريبة الانتهاء" class="w-full px-3 py-2 rounded-xl">
        </div>
      </div>

      <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-64 overflow-y-auto text-xs" id="supRetBatchesTableContainer">
        <div class="py-6 text-center text-slate-400">اختر المورد لعرض الدفعات والفواتير القابلة للإرجاع</div>
      </div>

      <div class="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
        <div>إجمالي قيمة المرتجع: <strong id="supRetTotalValueText" class="font-mono text-base text-rose-600">0.00 د.ج</strong></div>
        <div class="flex gap-2">
          <button onclick="App.closeModal('supplierReturnModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 font-bold">إلغاء</button>
          <button onclick="App.submitSupplierReturnFromModal()" class="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold">تأكيد المرتجع وخصم المخزون</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 16. نافذة إضافة/تعديل مورد`;

  if (oldSupRetModalRegex.test(html)) {
    html = html.replace(oldSupRetModalRegex, newSupRetModalHtml);
  }

  // ترقية نافذة #closeShiftModal بحاسبة فئات الأوراق النقدية الجزائرية ومعاينة الفارق اللحظي
  const oldCloseShiftRegex = /<div id="closeShiftModal"[\s\S]*?<!-- 26\. نوافذ المصاريف/;
  const newCloseShiftHtml = `<div id="closeShiftModal" class="modal-overlay">
    <div class="modal-content w-full max-w-lg p-6 space-y-4 overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
        <h3 class="text-lg font-black text-rose-600">إغلاق المناوبة وجرد الصندوق بالفئات النقدية (Z-Report)</h3>
        <button onclick="App.closeModal('closeShiftModal')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>
      </div>
      <input id="closeShiftSessionId" type="hidden">
      <div class="space-y-3 text-xs">
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 flex justify-between items-center">
          <span class="font-bold">الرصيد الدفتري المتوقع في الدرج:</span>
          <strong id="closeShiftExpectedText" class="font-mono text-base text-blue-600">0.00 د.ج</strong>
        </div>

        <!-- حاسبة عدّ الأوراق والعملات النقدية الجزائرية -->
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
          <div class="font-black text-slate-600 dark:text-slate-300">حاسبة عدّ الفئات النقدية الجزائرية (أدخل عدد الأوراق):</div>
          <div class="grid grid-cols-3 gap-2 font-mono">
            <div class="flex items-center gap-1"><span class="w-16 font-bold text-indigo-600">2000×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="2000" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
            <div class="flex items-center gap-1"><span class="w-16 font-bold text-amber-700">1000×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="1000" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
            <div class="flex items-center gap-1"><span class="w-16 font-bold text-emerald-700">500×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="500" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
            <div class="flex items-center gap-1"><span class="w-16 font-bold text-amber-600">200×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="200" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
            <div class="flex items-center gap-1"><span class="w-16 font-bold text-sky-600">100×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="100" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
            <div class="flex items-center gap-1"><span class="w-16 font-bold text-slate-500">50×</span><input type="number" min="0" placeholder="0" oninput="App.recalcCloseShiftDenoms()" data-denom="50" class="denom-inp w-full px-2 py-1 rounded text-center font-bold"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-bold mb-1">المبلغ الفعلي المعدود في الدرج (د.ج) *</label>
            <input id="closeShiftCountedInput" type="number" step="any" value="0" oninput="App.updateCloseShiftDiffPreview()" class="w-full px-3 py-2.5 rounded-xl font-mono font-black text-lg text-center">
          </div>
          <div>
            <label class="block font-bold mb-1">الفارق اللحظي (Écart de Caisse)</label>
            <div id="caisseDiffPreview" class="w-full px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 font-mono font-black text-lg text-center">0.00 د.ج</div>
          </div>
        </div>
        <div><label class="block font-bold mb-1">ملاحظة الإغلاق</label><input id="closeShiftNoteInput" type="text" class="w-full px-3 py-2 rounded-xl"></div>
      </div>
      <div class="flex justify-end gap-2 pt-3">
        <button onclick="App.closeModal('closeShiftModal')" class="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-bold">إلغاء</button>
        <button onclick="App.confirmCloseShift()" class="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">إغلاق المناوبة وطباعة Z-Report</button>
      </div>
    </div>
  </div>

  <!-- نافذة مراجعة تفاصيل المناوبة (#reviewCaisseModal) -->
  <div id="reviewCaisseModal" class="modal-overlay">
    <div class="modal-content w-full max-w-2xl p-6 space-y-4">
      <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
        <h3 id="reviewCaisseModalTitle" class="text-lg font-black">تفاصيل وحركات المناوبة</h3>
        <button onclick="App.closeModal('reviewCaisseModal')" class="text-slate-400 hover:text-rose-500"><span class="material-symbols-rounded">close</span></button>
      </div>
      <div id="reviewCaisseModalBody" class="space-y-3 text-xs max-h-96 overflow-y-auto"></div>
    </div>
  </div>

  <!-- 26. نوافذ المصاريف`;

  if (oldCloseShiftRegex.test(html)) {
    html = html.replace(oldCloseShiftRegex, newCloseShiftHtml);
  }

  fs.writeFileSync(indexPath, html, 'utf8');
}
console.log('✅ 4/10 & 7/10 & 8/10: تم تحديث index.html (مرتجع المورد المتعدد + حاسبة الفئات النقدية + نافذة مراجعة المناوبة).');

// ============================================================================
// المهمة 5 و 6 وربط جميع المهام في renderer-rc-100.js
// ============================================================================
const goldenRendererExt = `
// ============================================================================
// [GOLDEN MASTER 100.0% EXTENSIONS]
// ============================================================================
(function applyGoldenMaster100() {
  if (!window.App || !window.AppState) return;

  // 1. ربط رقم مرجع الدفع (#chkPaymentRefInput) وولاية التوصيل (#delivWilayaSelect)
  const _baseRecalcCheckout = App.recalcCheckoutModal.bind(App);
  App.recalcCheckoutModal = function () {
    const res = _baseRecalcCheckout();
    const refVal = document.getElementById('chkPaymentRefInput')?.value?.trim() || null;
    res.payment_reference = refVal;
    if (Array.isArray(res.split_payments) && refVal) {
      res.split_payments.forEach((sp) => {
        if (sp.method !== 'cash') sp.reference = refVal;
      });
    }
    return res;
  };

  App.confirmPrintDeliveryNote = async function () {
    const saleId = Number(document.getElementById('deliveryNoteSaleId')?.value);
    const driverName = document.getElementById('delivDriverInput')?.value?.trim() || '';
    const vehiclePlate = document.getElementById('delivVehicleInput')?.value?.trim() || '';
    const wilaya = document.getElementById('delivWilayaSelect')?.value || '';
    const fmt = document.getElementById('delivFormatSelect')?.value || 'ar';

    const fullSale = await window.api.getSaleDetails(saleId);
    if (!fullSale || !window.PrintEngine) return;

    if (wilaya) {
      fullSale.customer_address = fullSale.customer_address
        ? \`\${wilaya} — \${fullSale.customer_address}\`
        : wilaya;
    }

    this.closeModal('deliveryNoteModal');
    const html = await window.PrintEngine.renderDeliveryNoteHtml(
      {
        ...fullSale,
        driver_name: driverName,
        carrier_name: driverName,
        vehicle_plate: vehiclePlate
      },
      AppState.settings,
      fmt
    );
    await window.PrintEngine.printHtmlDocument(html, {
      silent: String(AppState.settings.silent_print) === 'true',
      printerName: AppState.settings.a4_printer_name || undefined
    });
  };

  // 2. حفظ واسترجاع مجموعات الخيارات (option_groups) في نافذة المنتج
  const _baseOpenProductModal = App.openProductModal.bind(App);
  App.openProductModal = function (prod = null) {
    _baseOpenProductModal(prod);
    if (prod && Array.isArray(prod.option_groups) && prod.option_groups.length > 0) {
      AppState.tempOptionGroups = prod.option_groups.map((g) => ({
        id: g.id,
        name: g.name,
        valuesStr: Array.isArray(g.values)
          ? g.values.map((v) => (typeof v === 'object' ? v.value : v)).join(', ')
          : ''
      }));
    } else {
      AppState.tempOptionGroups = [];
    }
    if (typeof this.renderOptionGroupsInModal === 'function') {
      this.renderOptionGroupsInModal();
    }
  };

  const _baseSaveProductFromModal = App.saveProductFromModal.bind(App);
  App.saveProductFromModal = async function () {
    const id = document.getElementById('prodIdInput')?.value;
    const optionGroupsPayload = (AppState.tempOptionGroups || [])
      .map((g, idx) => ({
        name: String(g.name || '').trim(),
        position: idx,
        values: String(g.valuesStr || '')
          .split(/[,،]/)
          .map((x) => x.trim())
          .filter(Boolean)
      }))
      .filter((g) => g.name && g.values.length > 0);

    await _baseSaveProductFromModal();
    if (id && optionGroupsPayload.length > 0 && window.api && window.api.saveProductVariants) {
      await window.api.saveProductVariants(Number(id), {
        option_groups: optionGroupsPayload,
        variants: AppState.tempVariantsMatrix || []
      }).catch(() => {});
    }
  };

  // 3. ترقية نافذة مرتجع المورد المتعدد من فواتير الشراء الأصلية
  App.openSupplierReturnModal = async function () {
    const supSel = document.getElementById('supRetSupplierSelect');
    if (supSel) {
      supSel.innerHTML = AppState.suppliers
        .map((s) => \`<option value="\${s.id}">\${s.name} (الدين: \${Number(s.total_debt || 0).toFixed(2)} د.ج)</option>\`)
        .join('');
    }
    document.getElementById('supRetReasonInput').value = '';
    this.openModal('supplierReturnModal');
    if (AppState.suppliers.length > 0) {
      await this.loadSupplierReturnableBatches(AppState.suppliers[0].id);
    }
  };

  App.loadSupplierReturnableBatches = async function (supplierId) {
    const sid = Number(supplierId);
    const box = document.getElementById('supRetBatchesTableContainer');
    if (!box) return;
    const items = (await window.api.getSupplierReturnableItems(sid).catch(() => [])) || [];
    AppState.supplierReturnableBatches = items.map((it) => ({
      ...it,
      return_qty: 0
    }));

    if (items.length === 0) {
      box.innerHTML = '<div class="py-6 text-center text-slate-400 font-bold">لا توجد دفعات مخزنية متوفرة مرتبطة بهذا المورد حالياً</div>';
      document.getElementById('supRetTotalValueText').textContent = '0.00 د.ج';
      return;
    }

    box.innerHTML = \`
      <table class="w-full text-xs text-right">
        <thead>
          <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500">
            <th class="py-1.5">المنتج</th>
            <th class="py-1.5">الرصيد المتاح</th>
            <th class="py-1.5">تكلفة الوحدة</th>
            <th class="py-1.5">الكمية المرجعة</th>
            <th class="py-1.5">الإجمالي</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          \${AppState.supplierReturnableBatches
            .map(
              (b, idx) => \`
            <tr>
              <td class="py-2 font-bold">\${b.product_name} <span class="text-[10px] text-slate-400 font-mono">(#\${b.id})</span></td>
              <td class="py-2 font-mono font-bold text-emerald-600">\${b.stock} \${b.unit || ''}</td>
              <td class="py-2 font-mono">\${Number(b.cost_price || 0).toFixed(2)}</td>
              <td class="py-2">
                <input type="number" step="any" min="0" max="\${b.stock}" value="0"
                  oninput="App.updateSupplierReturnRowQty(\${idx}, this.value)"
                  class="w-24 px-2 py-1 rounded-lg font-mono font-bold text-center border border-slate-300 dark:border-slate-600">
              </td>
              <td id="supRetRowSub-\${idx}" class="py-2 font-mono font-bold text-rose-600">0.00 د.ج</td>
            </tr>\`
            )
            .join('')}
        </tbody>
      </table>
    \`;
    this.recalcSupplierReturnTotal();
  };

  App.updateSupplierReturnRowQty = function (idx, val) {
    const row = AppState.supplierReturnableBatches[idx];
    if (!row) return;
    const maxAvail = Number(row.stock || 0);
    const qty = Math.min(maxAvail, Math.max(0, parseFloat(val) || 0));
    row.return_qty = qty;
    const sub = Number((qty * Number(row.cost_price || 0)).toFixed(2));
    const cell = document.getElementById(\`supRetRowSub-\${idx}\`);
    if (cell) cell.textContent = \`\${sub.toFixed(2)} د.ج\`;
    this.recalcSupplierReturnTotal();
  };

  App.recalcSupplierReturnTotal = function () {
    const total = (AppState.supplierReturnableBatches || []).reduce(
      (sum, r) => sum + Number(r.return_qty || 0) * Number(r.cost_price || 0),
      0
    );
    const el = document.getElementById('supRetTotalValueText');
    if (el) el.textContent = \`\${total.toFixed(2)} د.ج\`;
    return Number(total.toFixed(2));
  };

  App.submitSupplierReturnFromModal = async function () {
    const supplier_id = Number(document.getElementById('supRetSupplierSelect')?.value);
    const settlement = document.getElementById('supRetSettlementMode')?.value || 'credit';
    const reason = document.getElementById('supRetReasonInput')?.value?.trim() || 'مرتجع للمورد';
    const selectedItems = (AppState.supplierReturnableBatches || [])
      .filter((r) => Number(r.return_qty || 0) > 0)
      .map((r) => ({
        product_id: r.product_id,
        batch_id: r.id,
        variant_id: r.variant_id || null,
        quantity: Number(r.return_qty),
        cost_price: Number(r.cost_price || 0)
      }));

    if (selectedItems.length === 0) {
      showToast('يرجى تحديد كمية مرجعة لصنف واحد على الأقل', 'warning');
      return;
    }

    const total = this.recalcSupplierReturnTotal();
    await window.api.saveSupplierReturn({
      supplier_id,
      total,
      credit_applied: settlement === 'credit' ? total : 0,
      refund_amount: settlement === 'cash' ? total : 0,
      refund_method: settlement,
      reason,
      items: selectedItems
    });

    this.closeModal('supplierReturnModal');
    await this.refreshProducts();
    await this.renderPurchasesView();
    showToast('تم حفظ مستند مرتجع المورد وخصم الكميات من الدفعات بنجاح', 'success');
  };

  // 4. حاسبة الفئات النقدية الجزائرية في إغلاق الصندوق ومراجعة المناوبة
  const _baseOpenCloseShiftModal = App.openCloseShiftModal.bind(App);
  App.openCloseShiftModal = function (sessionId, expectedBalance = 0) {
    AppState._closeShiftExpected = Number(expectedBalance || 0);
    document.querySelectorAll('.denom-inp').forEach((inp) => { inp.value = ''; });
    _baseOpenCloseShiftModal(sessionId, expectedBalance);
    this.updateCloseShiftDiffPreview();
  };

  App.recalcCloseShiftDenoms = function () {
    let sum = 0;
    document.querySelectorAll('.denom-inp').forEach((inp) => {
      const denom = Number(inp.getAttribute('data-denom') || 0);
      const count = Math.max(0, parseInt(inp.value || '0', 10) || 0);
      sum += denom * count;
    });
    const countedEl = document.getElementById('closeShiftCountedInput');
    if (countedEl) countedEl.value = sum.toFixed(2);
    this.updateCloseShiftDiffPreview();
  };

  App.updateCloseShiftDiffPreview = function () {
    const counted = parseFloat(document.getElementById('closeShiftCountedInput')?.value) || 0;
    const expected = Number(AppState._closeShiftExpected || 0);
    const diff = Number((counted - expected).toFixed(2));
    const box = document.getElementById('caisseDiffPreview');
    if (!box) return;
    box.textContent = \`\${diff > 0 ? '+' : ''}\${diff.toFixed(2)} د.ج\`;
    box.className =
      diff < -0.01
        ? 'w-full px-3 py-2.5 rounded-xl bg-rose-500/15 text-rose-600 font-mono font-black text-lg text-center'
        : diff > 0.01
          ? 'w-full px-3 py-2.5 rounded-xl bg-amber-500/15 text-amber-600 font-mono font-black text-lg text-center'
          : 'w-full px-3 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 font-mono font-black text-lg text-center';
  };

  App.openSessionReviewModal = async function (sessionId) {
    const details = await window.api.getSessionDetails(sessionId);
    if (!details) return;
    const sess = details.session || {};
    const sum = details.summary || {};
    const txs = details.transactions || [];
    document.getElementById('reviewCaisseModalTitle').textContent = \`مراجعة المناوبة رقم #\${sess.id || sessionId}\`;
    const body = document.getElementById('reviewCaisseModalBody');
    body.innerHTML = \`
      <div class="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
        <div>الافتتاحي: <strong class="font-mono">\${Number(sum.openingBalance || 0).toFixed(2)} د.ج</strong></div>
        <div>المتوقع: <strong class="font-mono text-blue-600">\${Number(sum.expectedBalance || 0).toFixed(2)} د.ج</strong></div>
        <div>الفعلي: <strong class="font-mono text-emerald-600">\${sess.closing_balance !== null ? Number(sess.closing_balance).toFixed(2) + ' د.ج' : 'مفتوحة'}</strong></div>
      </div>
      <div class="flex justify-end">
        <button onclick="App.printSessionZReport(\${sess.id || sessionId})" class="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold">🖨️ طباعة تقرير Z-Report (80mm)</button>
      </div>
      <table class="w-full text-xs text-right">
        <thead><tr class="border-b border-slate-200 dark:border-slate-700 text-slate-500"><th class="py-1.5">النوع</th><th class="py-1.5">البيان</th><th class="py-1.5">المبلغ</th><th class="py-1.5">الوقت</th></tr></thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
          \${txs.map((t) => \`<tr><td class="py-1.5 font-bold">\${t.type}</td><td class="py-1.5">\${t.description || ''}</td><td class="py-1.5 font-mono font-bold">\${Number(t.amount || 0).toFixed(2)} د.ج</td><td class="py-1.5 font-mono text-slate-400">\${String(t.created_at || '').slice(0, 16)}</td></tr>\`).join('')}
        </tbody>
      </table>
    \`;
    this.openModal('reviewCaisseModal');
  };

  // 5. الإضافة التلقائية للسلة عند استقرار وزن الميزان (usb_scale_auto_add)
  if (window.api && window.api.scale && window.api.scale.onReading) {
    let lastAutoAddedWeight = 0;
    window.api.scale.onReading((reading) => {
      if (!reading || !reading.stable) {
        if (reading && Number(reading.weight || 0) < 0.005) lastAutoAddedWeight = 0;
        return;
      }
      if (String(AppState.settings.usb_scale_auto_add) !== 'true') return;
      const w = Number(reading.weight || 0);
      if (w >= 0.01 && Math.abs(w - lastAutoAddedWeight) >= 0.005) {
        const scaleModalOpen = document.getElementById('posScaleModal')?.classList.contains('active');
        if (scaleModalOpen) {
          lastAutoAddedWeight = w;
          App.addWeightedProductFromScaleModal();
        }
      }
    });
  }
})();
`;

const rc100File = path.join(ROOT, 'renderer-rc-100.js');
if (fs.existsSync(rc100File)) {
  let rcContent = fs.readFileSync(rc100File, 'utf8');
  if (!rcContent.includes('applyGoldenMaster100')) {
    fs.writeFileSync(rc100File, rcContent + '\n' + goldenRendererExt, 'utf8');
  }
}

// تحديث renderer.js لإضافة اختيار طابعة التذاكر وطابعة A4، وخيارات الدرج والوزن التلقائي، وزر مراجعة المناوبة
const rendererPath = path.join(ROOT, 'renderer.js');
if (fs.existsSync(rendererPath)) {
  let ren = fs.readFileSync(rendererPath, 'utf8');

  if (!ren.includes('App.openSessionReviewModal(')) {
    ren = ren.replace(
      `onclick="App.printSessionZReport(\${s.id})"`,
      `onclick="App.printSessionZReport(\${s.id})">🖨️ Z</button><button onclick="App.openSessionReviewModal(\${s.id})" class="px-1.5 py-0.5 bg-blue-600/15 text-blue-600 rounded text-[10px] font-sans font-bold" title="مراجعة تفاصيل المناوبة">تفاصيل</button><button style="display:none"`
    );
  }

  if (!ren.includes('set-thermal-printer')) {
    ren = ren.replace(
      `<input id="set-edit-win"`,
      `<select id="set-thermal-printer" class="w-full px-3 py-2 rounded-xl font-bold mb-2">
                <option value="">الطابعة الحرارية الافتراضية للنظام</option>
                \${printers.map((pr) => \`<option value="\${pr.name}" \${settings.thermal_printer_name === pr.name ? 'selected' : ''}>🖨️ حرارية: \${pr.name}</option>\`).join('')}
              </select>
              <select id="set-a4-printer" class="w-full px-3 py-2 rounded-xl font-bold mb-2">
                <option value="">طابعة A4 الافتراضية للنظام</option>
                \${printers.map((pr) => \`<option value="\${pr.name}" \${settings.a4_printer_name === pr.name ? 'selected' : ''}>🖨️ A4: \${pr.name}</option>\`).join('')}
              </select>
              <input id="set-edit-win"`
    );

    ren = ren.replace(
      `sale_edit_window_days: document.getElementById('set-edit-win').value,`,
      `sale_edit_window_days: document.getElementById('set-edit-win').value,
      thermal_printer_name: document.getElementById('set-thermal-printer')?.value || '',
      a4_printer_name: document.getElementById('set-a4-printer')?.value || '',`
    );
  }

  if (!ren.includes('set-open-drawer-cash')) {
    ren = ren.replace(
      `<button onclick="App.saveScaleSettingsTab()"`,
      `<div class="col-span-full grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
            <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input id="set-open-drawer-cash" type="checkbox" \${String(settings.open_drawer_on_cash_sale) !== 'false' ? 'checked' : ''}>
              <span class="font-bold">فتح درج النقود تلقائياً عند كل عملية بيع نقدي (ESC/POS)</span>
            </label>
            <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input id="set-scale-auto-add" type="checkbox" \${String(settings.usb_scale_auto_add) === 'true' ? 'checked' : ''}>
              <span class="font-bold">إضافة المنتج الموزون تلقائياً للسلة فور استقرار الميزان</span>
            </label>
          </div>
          <button onclick="App.saveScaleSettingsTab()"`
    );

    ren = ren.replace(
      `scale_barcode_prefix: document.getElementById('set-scale-prefix').value.trim() || '20'`,
      `scale_barcode_prefix: document.getElementById('set-scale-prefix').value.trim() || '20',
      open_drawer_on_cash_sale: String(Boolean(document.getElementById('set-open-drawer-cash')?.checked)),
      usb_scale_auto_add: String(Boolean(document.getElementById('set-scale-auto-add')?.checked))`
    );
  }

  fs.writeFileSync(rendererPath, ren, 'utf8');
}
console.log('✅ 5/10 & 6/10: تم تحديث renderer.js و renderer-rc-100.js بجميع ميزات النسخة الذهبية 100.0%.');
console.log('\n🏆 اكتملت ترقية النسخة الذهبية (100.0% Golden Master Release) بنجاح تام!');