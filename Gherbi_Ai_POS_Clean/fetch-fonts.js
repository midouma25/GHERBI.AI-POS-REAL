/**
 * fetch-fonts.js
 * سكربت تحميل الخطوط والأيقونات المحلية آلياً لنظام Gherbi.Ai POS
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const FONTS_DIR = path.join(__dirname, 'assets', 'fonts');

// التأكد من وجود المجلد
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

// روابط ثابتة ومضمونة لملفات الخطوط بصيغة woff2
const fontsToDownload = [
  { url: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.8/files/cairo-arabic-400-normal.woff2', name: 'Cairo-Regular.woff2' },
  { url: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.8/files/cairo-arabic-600-normal.woff2', name: 'Cairo-SemiBold.woff2' },
  { url: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.8/files/cairo-arabic-700-normal.woff2', name: 'Cairo-Bold.woff2' },
  { url: 'https://cdn.jsdelivr.net/npm/@fontsource/cairo@5.0.8/files/cairo-arabic-900-normal.woff2', name: 'Cairo-Black.woff2' },
  { url: 'https://cdn.jsdelivr.net/npm/@fontsource/tajawal@5.0.8/files/tajawal-arabic-400-normal.woff2', name: 'Tajawal-Regular.woff2' },
  { url: 'https://cdn.jsdelivr.net/npm/@fontsource/tajawal@5.0.8/files/tajawal-arabic-700-normal.woff2', name: 'Tajawal-Bold.woff2' },
  { url: 'https://cdn.jsdelivr.net/npm/material-symbols@0.22.1/rounded.woff2', name: 'material-symbols-rounded.woff2' }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`فشل التحميل: ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function startDownload() {
  console.log('🚀 جاري تحميل الخطوط والأيقونات الرسمية...');
  for (const font of fontsToDownload) {
    const dest = path.join(FONTS_DIR, font.name);
    process.stdout.write(`⏳ تحميل ${font.name}... `);
    try {
      await downloadFile(font.url, dest);
      console.log('✅ تم بنجاح!');
    } catch (err) {
      console.log(`❌ خطأ: ${err.message}`);
    }
  }
  console.log('\n🎉 اكتمل تحميل جميع الخطوط والأيقونات! يمكنك تشغيل النظام الآن.');
}

startDownload();