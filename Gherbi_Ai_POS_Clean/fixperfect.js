/**
 * fix-perfect-system.js
 * الترقية الهندسية الشاملة لإصلاح الأيقونات (SVG Vector Engine)، توحيد الألوان (Dark/Light Class Mode)،
 * تحسين الواجهة الأمامية والخلفية، وإضافة بذر البيانات النموذجية للسوق الجزائري.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

// ============================================================================
// 1. حذف ملف خط الأيقونات التالف وتحصين material-symbols.css
// ============================================================================
const badFontPath = path.join(ROOT, 'assets', 'fonts', 'material-symbols-rounded.woff2');
if (fs.existsSync(badFontPath)) {
  try { fs.unlinkSync(badFontPath); } catch (_) {}
}

const cleanMaterialCss = `/**
 * assets/css/material-symbols.css
 * تنسيق حاويات الأيقونات المتجهة (Vector SVG Icons) لنظام Gherbi.Ai POS
 */

.material-symbols-rounded {
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

.material-symbols-rounded svg {
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
console.log('✅ 1/6: تم تنظيف ملف الأيقونات التالف وتحديث material-symbols.css');

// ============================================================================
// 2. إنشاء محرك الأيقونات المتجهة الذاتي (assets/js/svg-icons.js) - 100% Offline
// ============================================================================
const svgIconsEngineCode = `/**
 * assets/js/svg-icons.js
 * محرك الأيقونات المتجهة المدمج (100% Offline SVG Icon Engine)
 * يحول جميع عناصر .material-symbols-rounded إلى أيقونات SVG عالية الدقة تلقائياً
 */

'use strict';

(function () {
  const PATHS = {
    point_of_sale: 'M17 2H7c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 4H7V4h10v2zm3 16H4c-1.1 0-2-.9-2-2v-1h20v1c0 1.1-.9 2-2 2zM18.5 9h-13c-.83 0-1.5.67-1.5 1.5v6.5h16v-6.5c0-.83-.67-1.5-1.5-1.5zM9 15H7v-1h2v1zm0-2H7v-1h2v1zm4 2h-2v-1h2v1zm0-2h-2v-1h2v1zm4 2h-2v-1h2v1zm0-2h-2v-1h2v1z',
    shopping_cart_checkout: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-8.9-5h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4l-3.87 7H8.53L4.27 2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7l1.1-2z',
    receipt_long: 'M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM15 20H6c-.55 0-1-.45-1-1v-1h10v2zm4-1c0 .55-.45 1-1 1s-1-.45-1-1v-3H8V5h11v14zM9 7h6v2H9V7zm0 3h6v2H9v-2z',
    account_balance_wallet: 'M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    inventory_2: 'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
    redeem: 'M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z',
    precision_manufacturing: 'M19.93 8.35l-3.6 1.68L14 7.7V6.3l2.33-2.33 3.6 1.68c.38.18.82-.01 1-.39.18-.38-.01-.82-.39-1l-3.92-1.83c-.38-.18-.83-.1-1.13.2L13.12 5H11v2.12L5.83 12.3c-.36.36-.58.86-.58 1.41V18H4c-1.1 0-2 .9-2 2v2h20v-2c0-1.1-.9-2-2-2h-7.25v-3.88l4.46-4.46 2.12 2.12c.3.3.75.38 1.13.2l3.92-1.83c.38-.18.57-.62.39-1-.18-.38-.63-.57-1.01-.39z',
    fact_check: 'M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10 17H5v-2h5v2zm0-4H5v-2h5v2zm0-4H5V7h5v2zm4.82 6L12 12.16l1.41-1.41 1.41 1.42L17.99 9l1.42 1.42L14.82 15z',
    qr_code_2: 'M15 21h-2v-2h2v2zm-2-7h-2v5h2v-5zm8-2h-2v4h2v-4zm-2-2h-2v2h2v-2zM7 12H5v2h2v-2zm-2-2H3v2h2v-2zm7-5h2V3h-2v2zm-7.5-.5v3h3v-3h-3zM9 9H3V3h6v6zm-4.5 7.5v3h3v-3h-3zM9 21H3v-6h6v6zm10.5-16.5v3h3v-3h-3zM21 9h-6V3h6v6zm-2 10v-3h-4v2h2v3h4v-2h-2z',
    local_shipping: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    shopping_bag: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',
    groups: 'M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z',
    description: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    assignment: 'M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
    payments: 'M19 14V6c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-9-1c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm13-6v11c0 1.1-.9 2-2 2H4v-2h17V7h2z',
    monitoring: 'M3 13h2v8H3v-8zm4-3h2v11H7V10zm4-4h2v15h-2V6zm4 6h2v9h-2v-9zm4-8h2v17h-2V4z',
    auto_awesome: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z',
    manage_accounts: 'M10 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 8c3.31 0 6 1.79 6 4v2H4v-2c0-2.21 2.69-4 6-4zm9.43 4.02c.36-.59.57-1.28.57-2.02s-.21-1.43-.57-2.02l1.23-1.23-1.41-1.41-1.23 1.23c-.59-.36-1.28-.57-2.02-.57s-1.43.21-2.02.57l-1.23-1.23-1.41 1.41 1.23 1.23c-.36.59-.57 1.28-.57 2.02s.21 1.43.57 2.02l-1.23 1.23 1.41 1.41 1.23-1.23c.59.36 1.28.57 2.02.57s1.43-.21 2.02-.57l1.23 1.23 1.41-1.41-1.23-1.23zM16 17.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    menu_open: 'M3 18h13v-2H3v2zm0-5h10v-2H3v2zm0-7v2h13V6H3zm18 9.59L17.42 12 21 8.41 19.59 7l-5 5 5 5L21 15.59z',
    verified: 'M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z',
    logout: 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
    search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    barcode_scanner: 'M4 6h2v12H4V6zm3 0h1v12H7V6zm2 0h3v12H9V6zm4 0h1v12h-1V6zm3 0h2v12h-2V6zm3 0h1v12h-1V6zM2 4v4H0V4c0-1.1.9-2 2-2h4v2H2zm20-2c1.1 0 2 .9 2 2v4h-2V4h-4V2h4zM2 16v4h4v2H2c-1.1 0-2-.9-2-2v-4h2zm20 4v-4h2v4c0 1.1-.9 2-2 2h-4v-2h4z',
    scale: 'M14 11V8c4.56-.58 8-3.1 8-6H2c0 2.9 3.44 5.42 8 6v3c-3.68.73-8 3.61-8 11h6v-2H4.13c.93-4.05 4.06-6.6 7.87-6.6s6.94 2.55 7.87 6.6H16v2h6c0-7.39-4.32-10.27-8-11zm-2-6c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z',
    dark_mode: 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z',
    fullscreen: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
    add_shopping_cart: 'M11 9h2V6h3V4h-3V1h-2v3H8v2h3v3zm-4 9c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zm10 0c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2zm-8.9-5h7.45c.75 0 1.41-.41 1.75-1.03l3.86-7.01L19.42 4l-3.87 7H8.53L4.27 2H1v2h2l3.6 7.59-1.35 2.44C4.52 15.37 5.48 17 7 17h12v-2H7l1.1-2z',
    keyboard_return: 'M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7h-2z',
    add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    person_add: 'M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    shopping_basket: 'M17.21 9l-4.38-6.56c-.19-.28-.51-.42-.83-.42-.32 0-.64.14-.83.43L6.79 9H2c-.55 0-1 .45-1 1 0 .09.01.18.04.27l2.54 9.27c.23.84 1 1.46 1.92 1.46h13c.92 0 1.69-.62 1.93-1.46l2.54-9.27L23 10c0-.55-.45-1-1-1h-4.79zM9 9l3-4.4L15 9H9zm3 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z',
    delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
    receipt: 'M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z',
    print: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z',
    check_circle: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
    lock_person: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
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
    verified_user: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z'
  };

  const DEFAULT_PATH = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z';

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
    const nodes = root.querySelectorAll('.material-symbols-rounded');
    nodes.forEach(convertSpanToSvg);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      scanAndRenderIcons(document);
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (node.classList && node.classList.contains('material-symbols-rounded')) {
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

fs.writeFileSync(path.join(ROOT, 'assets', 'js', 'svg-icons.js'), svgIconsEngineCode, 'utf8');
console.log('✅ 2/6: تم إنشاء محرك الأيقونات المتجهة المدمج (assets/js/svg-icons.js)');

// ============================================================================
// 3. تحديث index.html و activation.html لتفعيل darkMode: "class" وتحميل svg-icons.js
// ============================================================================
const tailwindConfigScript = `<script>
  window.tailwind = window.tailwind || {};
  window.tailwind.config = { darkMode: 'class' };
</script>`;

['index.html', 'activation.html'].forEach((fileName) => {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  if (!html.includes("darkMode: 'class'")) {
    html = html.replace(
      '<script src="./assets/js/tailwind.min.js"></script>',
      `${tailwindConfigScript}\n  <script src="./assets/js/tailwind.min.js"></script>`
    );
  }

  if (!html.includes('svg-icons.js')) {
    html = html.replace(
      '</head>',
      '  <script src="./assets/js/svg-icons.js"></script>\n</head>'
    );
  }

  fs.writeFileSync(filePath, html, 'utf8');
});
console.log('✅ 3/6: تم ضبط tailwind.config = { darkMode: "class" } وربط محرك الأيقونات في index.html و activation.html');

// ============================================================================
// 4. تحسين styles.css لتظهر الواجهة والأزرار والحقول بتصميم عصري متناسق 100%
// ============================================================================
const polishedStyles = `/**
 * styles.css
 * ملف التنسيقات الرئيسي (Master Stylesheet) لنظام Gherbi.Ai POS
 */

:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-secondary: #0f172a;
  --bg-main: #f1f5f9;
  --bg-surface: #ffffff;
  --text-main: #0f172a;
  --text-muted: #64748b;
  --border-color: #e2e8f0;
  --sidebar-width: 255px;
  --sidebar-collapsed-width: 72px;
  --header-height: 64px;
  --font-primary: 'Cairo', 'Tajawal', system-ui, -apple-system, sans-serif;
  --font-numbers: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

html.dark {
  --color-primary: #3b82f6;
  --color-primary-hover: #60a5fa;
  --color-secondary: #020617;
  --bg-main: #0f172a;
  --bg-surface: #1e293b;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --border-color: #334155;
}

html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  font-family: var(--font-primary);
  background-color: var(--bg-main);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
}

.financial-number, .price-tag, .font-mono {
  font-family: var(--font-numbers);
  letter-spacing: 0.3px;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 9999px;
}
html.dark ::-webkit-scrollbar-thumb {
  background-color: #475569;
}

#app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

#sidebar {
  width: var(--sidebar-width);
  background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
  color: #ffffff;
  transition: width 0.25s ease;
  display: flex;
  flex-direction: column;
  z-index: 40;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.12);
}

#sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}
#sidebar.collapsed .sidebar-label {
  display: none;
}

#main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: var(--bg-main);
}

#top-header {
  height: var(--header-height);
  background-color: var(--bg-surface);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1.25rem;
  z-index: 30;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.view-section {
  display: none;
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1.25rem;
}
.view-section.active {
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.2s ease forwards;
}

.pos-layout {
  display: grid;
  grid-template-columns: 1fr 410px;
  gap: 1rem;
  height: calc(100vh - var(--header-height) - 2.5rem);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
  gap: 0.85rem;
  align-content: start;
}

.product-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 0.85rem;
  padding: 0.85rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.product-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.15);
  border-color: var(--color-primary);
}

.cart-container {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
}

.cart-items {
  flex: 1;
  overflow-y: auto;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-overlay.active {
  display: flex;
}
.modal-content {
  background-color: var(--bg-surface);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: 1.25rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  max-width: 92vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
select,
textarea {
  background-color: var(--bg-surface);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

input:focus, select:focus, textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

fs.writeFileSync(path.join(ROOT, 'styles.css'), polishedStyles, 'utf8');
console.log('✅ 4/6: تم تحديث styles.css لتصميم نظيف ومتناسق.');

// ============================================================================
// 5. تحديث main.js و preload.js لإيقاف تحذير التطوير وإضافة بذر البيانات النموذجية
// ============================================================================
const mainPath = path.join(ROOT, 'main.js');
if (fs.existsSync(mainPath)) {
  let mainCode = fs.readFileSync(mainPath, 'utf8');

  if (!mainCode.includes('ELECTRON_DISABLE_SECURITY_WARNINGS')) {
    mainCode = "process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';\n" + mainCode;
  }

  if (!mainCode.includes("ipcMain.handle('seed-demo-data'")) {
    const seedHandlerCode = `
  ipcMain.handle('seed-demo-data', async () => {
    const sampleProducts = [
      { barcode: '6130001001', name: 'حليب مجفف لويا 500غ', category: 'مواد غذائية', supplier: 'مؤسسة التوزيع الغذائي', unit: 'علبة', cost_price: 420, selling_price: 500, wholesale_price: 475, stock: 60, min_stock: 10 },
      { barcode: '6130001002', name: 'زيت مائدة إيليو 5 لتر', category: 'مواد غذائية', supplier: 'مجمع سيفيتال', unit: 'قارورة', cost_price: 590, selling_price: 650, wholesale_price: 630, stock: 45, min_stock: 8 },
      { barcode: '6130001003', name: 'قهوة مطحونة بونال 250غ', category: 'مشروبات وقهوة', supplier: 'مؤسسة التوزيع الغذائي', unit: 'علبة', cost_price: 260, selling_price: 320, wholesale_price: 300, stock: 80, min_stock: 15 },
      { barcode: '6130001004', name: 'سكر أبيض 1 كغ', category: 'مواد غذائية', supplier: 'مجمع سيفيتال', unit: 'كيس', cost_price: 85, selling_price: 105, wholesale_price: 98, stock: 120, min_stock: 20 },
      { barcode: '6130001005', name: 'عصير فواكه طبيعي 1 لتر', category: 'مشروبات وقهوة', supplier: 'مؤسسة المشروبات', unit: 'علبة', cost_price: 110, selling_price: 150, wholesale_price: 135, stock: 75, min_stock: 12 },
      { barcode: '6130001006', name: 'فرينة ممتازة 5 كغ', category: 'مواد غذائية', supplier: 'مطاحن الشرق', unit: 'كيس', cost_price: 240, selling_price: 300, wholesale_price: 280, stock: 50, min_stock: 10 },
      { barcode: '6130001007', name: 'جبن طري 16 قطعة', category: 'أجبان وألبان', supplier: 'مؤسسة الألبان', unit: 'علبة', cost_price: 175, selling_price: 230, wholesale_price: 210, stock: 65, min_stock: 10 },
      { barcode: '6130001008', name: 'ماء معدني سعيدة 1.5 لتر', category: 'مشروبات وقهوة', supplier: 'مؤسسة المشروبات', unit: 'قارورة', cost_price: 30, selling_price: 45, wholesale_price: 38, stock: 200, min_stock: 24 },
      { barcode: '00105', plu_code: '00105', name: 'لوز مقشر ممتاز (ميزان)', category: 'مكسرات وحلويات', supplier: 'مؤسسة التوزيع الغذائي', unit: 'كغ', cost_price: 1900, selling_price: 2400, wholesale_price: 2200, stock: 25, min_stock: 5 }
    ];

    await db.withTransaction(async () => {
      for (const p of sampleProducts) {
        const ex = await dbGet('SELECT id FROM products WHERE barcode = ? AND deleted_at IS NULL', [p.barcode]);
        if (ex) continue;
        await ensureSupplierByName(p.supplier);
        const ins = await dbRun(
          'INSERT INTO products (barcode, name, category, supplier, unit, min_stock, plu_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [p.barcode, p.name, p.category, p.supplier, p.unit, p.min_stock, p.plu_code || null]
        );
        await dbRun(
          'INSERT INTO inventory_batches (product_id, stock, cost_price, selling_price, wholesale_price) VALUES (?, ?, ?, ?, ?)',
          [ins.lastID, p.stock, p.cost_price, p.selling_price, p.wholesale_price]
        );
      }

      const custCount = await dbGet('SELECT COUNT(*) AS c FROM customers WHERE deleted_at IS NULL');
      if (Number(custCount.c || 0) === 0) {
        await dbRun(
          'INSERT INTO customers (name, phone, address, initial_debt, credit_limit, loyalty_points) VALUES (?, ?, ?, ?, ?, ?)',
          ['سوبرماركت النور (زبون جملة)', '0550112233', 'قسنطينة', 4500, 50000, 45]
        );
        await dbRun(
          'INSERT INTO customers (name, phone, address, initial_debt, credit_limit, loyalty_points) VALUES (?, ?, ?, ?, ?, ?)',
          ['محمد أمين بن علي', '0661223344', 'الجزائر الوسطى', 0, 20000, 12]
        );
      }
    });
    return { success: true };
  });
`;
    mainCode = mainCode.replace("ipcMain.handle('reset-system'", seedHandlerCode + "\n  ipcMain.handle('reset-system'");
  }

  fs.writeFileSync(mainPath, mainCode, 'utf8');
  console.log('✅ 5/6: تم تحديث main.js لإيقاف تحذيرات التطوير وإضافة بذر البيانات النموذجية.');
}

const preloadPath = path.join(ROOT, 'preload.js');
if (fs.existsSync(preloadPath)) {
  let preCode = fs.readFileSync(preloadPath, 'utf8');
  if (!preCode.includes('seedDemoData:')) {
    preCode = preCode.replace(
      "resetSystem: () => invoke('reset-system'),",
      "resetSystem: () => invoke('reset-system'),\n  seedDemoData: () => invoke('seed-demo-data'),"
    );
    fs.writeFileSync(preloadPath, preCode, 'utf8');
  }
}

// ============================================================================
// 6. تحديث renderer.js لإضافة زر تعبئة البيانات التجريبية في الشاشة الفارغة
// ============================================================================
const rendererPath = path.join(ROOT, 'renderer.js');
if (fs.existsSync(rendererPath)) {
  let renCode = fs.readFileSync(rendererPath, 'utf8');

  if (!renCode.includes('seedSampleStoreData')) {
    renCode = renCode.replace(
      `<div class="text-sm font-bold">لا توجد منتجات مطابقة للبحث</div>`,
      `<div class="text-sm font-bold">لا توجد منتجات مطابقة للبحث أو المخزون فارغ</div>
          <div class="pt-2">
            <button onclick="App.seedSampleStoreData()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow">
              + تحميل بيانات متجر جزائري نموذجي للتجربة الفورية
            </button>
          </div>`
    );

    const helperMethod = `
  async seedSampleStoreData() {
    if (!window.api || !window.api.seedDemoData) return;
    await window.api.seedDemoData();
    await this.refreshProducts();
    this.renderPosView();
    showToast('تم تحميل المنتجات والزبائن والموردين النموذجيين بنجاح!', 'success');
  },
`;
    renCode = renCode.replace('selectPosCategory(cat) {', helperMethod + '\n  selectPosCategory(cat) {');
    fs.writeFileSync(rendererPath, renCode, 'utf8');
    console.log('✅ 6/6: تم تحديث renderer.js لإضافة التعبئة الفورية للبيانات النموذجية.');
  }
}

console.log('\n🎉 اكتملت جميع الإصلاحات بنجاح! شغّل النظام الآن عبر: npm run dev');