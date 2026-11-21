// Image helpers: load, crop to a 4:5 thumbnail, and shrink a display copy. Runs entirely on the phone.
import { CONFIG } from './config.js';

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this photo')); };
    img.src = url;
  });
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => {
      if (b && b.type === 'image/webp') return resolve(b);
      canvas.toBlob((j) => resolve(j), 'image/jpeg', quality); // fallback
    }, 'image/webp', quality);
  });
}

// crop = { s, tx, ty, frameW, mode } as set by the crop screen. Null = centred "fill".
export function defaultCrop(w, h, frameW = 300) {
  const frameH = frameW * (CONFIG.THUMB_H / CONFIG.THUMB_W);
  const s = Math.max(frameW / w, frameH / h);
  return { s, tx: (frameW - w * s) / 2, ty: (frameH - h * s) / 2, frameW, mode: 'fill' };
}

export async function makeThumb(img, w, h, crop) {
  const c = crop || defaultCrop(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = CONFIG.THUMB_W;
  canvas.height = CONFIG.THUMB_H;
  const ctx = canvas.getContext('2d');
  const k = CONFIG.THUMB_W / c.frameW;
  ctx.fillStyle = '#E9E5DC';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.setTransform(k * c.s, 0, 0, k * c.s, c.tx * k, c.ty * k);
  ctx.drawImage(img, 0, 0);
  const blob = await toBlob(canvas, CONFIG.WEBP_QUALITY);
  canvas.width = canvas.height = 0; // free memory
  return blob;
}

export async function makeDisplay(img, w, h) {
  const scale = Math.min(1, CONFIG.DISPLAY_MAX / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await toBlob(canvas, CONFIG.WEBP_QUALITY);
  const out = { blob, width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 0;
  return out;
}

export const fileDateISO = (file) => {
  const d = new Date(file.lastModified || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
