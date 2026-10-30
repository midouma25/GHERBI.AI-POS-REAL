/**
 * imageUtils.js
 * وحدة معالجة وتحويل وحفظ صور المنتجات والمتغيرات وشعار المتجر
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_URL_PATTERN = /^data:image\/([a-zA-Z0-9+.-]+);base64,([\s\S]+)$/;

function getImagesDir() {
  let baseDir = path.join(process.cwd(), 'data');
  try {
    const electron = require('electron');
    const app = electron.app || (electron.remote && electron.remote.app);
    if (app && typeof app.getPath === 'function') {
      baseDir = app.getPath('userData');
    }
  } catch (_) {}

  const dir = path.join(baseDir, 'product_images');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function subtypeToExt(sub = '') {
  const s = String(sub).toLowerCase().trim();
  if (s === 'jpeg' || s === 'jpg') return 'jpg';
  if (s === 'webp') return 'webp';
  if (s === 'gif') return 'gif';
  if (s === 'svg+xml' || s === 'svg') return 'svg';
  return 'png';
}

function processImage(imageInput, options = {}) {
  if (!imageInput || typeof imageInput !== 'string') return null;
  const trimmed = imageInput.trim();
  if (!trimmed) return null;

  const match = DATA_URL_PATTERN.exec(trimmed);
  if (!match) {
    if (
      !trimmed.startsWith('http://') &&
      !trimmed.startsWith('https://') &&
      !trimmed.startsWith('file://') &&
      !trimmed.startsWith('data:') &&
      fs.existsSync(trimmed)
    ) {
      try {
        const ext = path.extname(trimmed).replace('.', '').toLowerCase() || 'png';
        const buf = fs.readFileSync(trimmed);
        const mime = ext === 'jpg' ? 'jpeg' : ext;
        return `data:image/${mime};base64,${buf.toString('base64')}`;
      } catch (_) {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (options.saveToDisk) {
    try {
      const ext = subtypeToExt(match[1]);
      const buf = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
      const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 20);
      const filePath = path.join(getImagesDir(), `${options.prefix || 'img'}_${hash}.${ext}`);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buf);
      }
      return filePath;
    } catch (_) {
      return trimmed;
    }
  }

  return trimmed;
}

function imageToDataUrl(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed || trimmed.startsWith('data:image/')) return trimmed || null;

  const cleanPath = trimmed.replace(/^file:\/\/\/?/, '');
  if (fs.existsSync(cleanPath)) {
    try {
      const ext = path.extname(cleanPath).replace('.', '').toLowerCase() || 'png';
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      const buf = fs.readFileSync(cleanPath);
      return `data:image/${mime};base64,${buf.toString('base64')}`;
    } catch (_) {
      return trimmed;
    }
  }
  return trimmed;
}

function deleteLocalImage(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return false;
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) return false;
  try {
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      return true;
    }
  } catch (_) {}
  return false;
}

module.exports = {
  getImagesDir,
  processImage,
  saveProductImage: processImage,
  imageToDataUrl,
  deleteLocalImage
};