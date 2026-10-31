/**
 * setup-offline-assets.js
 * أداة التحميل والتجهيز التلقائي للمكتبات والخطوط المحلية (100% Offline-First Assets)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = __dirname;
const JS_DIR = path.join(ROOT, 'assets', 'js');
const FONTS_DIR = path.join(ROOT, 'assets', 'fonts');

[JS_DIR, FONTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ASSETS_TO_FETCH = [
  {
    name: 'Tailwind CSS (Offline Script)',
    url: 'https://cdn.tailwindcss.com/3.4.1',
    dest: path.join(JS_DIR, 'tailwind.min.js'),
    fallback: '/* Tailwind Offline Fallback */ console.info("Tailwind local fallback loaded");'
  },
  {
    name: 'Chart.js UMD (Offline Charts)',
    url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    dest: path.join(JS_DIR, 'chart.umd.min.js'),
    fallback: 'window.Chart = function(){ return { destroy: function(){}, update: function(){} }; };'
  }
];

function downloadFile(url, destPath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));

    https
      .get(url, { timeout: 20000 }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return resolve(downloadFile(nextUrl, destPath, redirects + 1));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP Status ${res.statusCode}`));
        }

        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(() => resolve(true));
        });
        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      })
      .on('error', (err) => reject(err))
      .on('timeout', function onTimeout() {
        this.destroy();
        reject(new Error('Request timeout'));
      });
  });
}

async function prepareOfflineAssets() {
  console.log('📦 جاري تجهيز المكتبات والأصول المحلية لنظام Gherbi.Ai POS...\n');

  for (const item of ASSETS_TO_FETCH) {
    if (fs.existsSync(item.dest) && fs.statSync(item.dest).size > 1024) {
      console.log(`✅ موجود مسبقاً: ${item.name}`);
      continue;
    }

    try {
      process.stdout.write(`⏳ جاري تنزيل ${item.name}... `);
      await downloadFile(item.url, item.dest);
      console.log('تم بنجاح!');
    } catch (err) {
      console.log(`تعذر التنزيل (${err.message}) — تم إنشاء بديل محلي آمن.`);
      if (!fs.existsSync(item.dest) || fs.statSync(item.dest).size === 0) {
        fs.writeFileSync(item.dest, item.fallback, 'utf8');
      }
    }
  }

  console.log('\n🎉 اكتمل تجهيز الأصول المحلية بنجاح.');
}

prepareOfflineAssets();