// Image helpers: load, crop to a 4:5 thumbnail, and shrink a display copy. Runs entirely on the phone.
import { CONFIG } from './config.js';

// Why a photo can't be opened, in words the person can act on.
export function unreadableReason(file) {
  const name = (file.name || '').toLowerCase(), type = (file.type || '').toLowerCase();
  if (!file.size) return "This photo isn't on your phone yet (it may only be in Google Photos online). Open it in Google Photos so it downloads, then try again.";
  if (/hei[cf]/.test(type) || /\.hei[cf]$/.test(name)) return 'This photo is in HEIC format, which Chrome can’t open yet. Turn off "High efficiency" photos in your camera settings, or pick a JPEG.';
  return `Could not open this photo (${type || 'unknown type'}, ${(file.size / 1048576).toFixed(1)} MB). Close the app fully and try again. If it still fails, Chrome can't read this photo's format.`;
}

// The biggest copy the app ever needs (the display copy is 1600 px). Photos are shrunk to this right
// after decoding, so a full-size camera photo (up to ~200 MB in memory) only exists for a moment.
const WORK_MAX = 2048;

// Size and camera rotation from a JPEG's header (reads only the first 256 KB). Null if not a JPEG.
export async function jpegInfo(file) {
  try {
    const v = new DataView(await file.slice(0, 262144).arrayBuffer());
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    let o = 2, orient = 1;
    while (o + 9 < v.byteLength) {
      if (v.getUint8(o) !== 0xFF) { o++; continue; }
      const m = v.getUint8(o + 1);
      if (m === 0xFF) { o++; continue; }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { o += 2; continue; }
      const len = v.getUint16(o + 2);
      if (m === 0xE1 && v.getUint32(o + 4) === 0x45786966) orient = exifOrientation(v, o + 10) || orient; // "Exif"
      if ((m >= 0xC0 && m <= 0xCF) && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        const h = v.getUint16(o + 5), w = v.getUint16(o + 7);
        return w && h ? { w, h, orient } : null;
      }
      o += 2 + len;
    }
  } catch (_) { /* unreadable header */ }
  return null;
}
function exifOrientation(v, t) {
  const le = v.getUint16(t) === 0x4949;
  const ifd = t + v.getUint32(t + 4, le);
  const n = v.getUint16(ifd, le);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le);
  }
  return 0;
}

// Big JPEG: ask Chrome for a ready-shrunk copy, so the full-size photo (a 15 MB file can be 400+ MB
// once opened) never has to sit in memory as a whole.
async function decodeScaled(file) {
  const info = await jpegInfo(file);
  if (!info) throw new Error('not a jpeg');
  let w = info.w, h = info.h;
  if (info.orient >= 5 && info.orient <= 8) [w, h] = [h, w]; // upright size
  const k = WORK_MAX / Math.max(w, h);
  if (k >= 1) throw new Error('small enough');
  const tw = Math.round(w * k), th = Math.round(h * k);
  let bm = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' });
  if ((bm.width > bm.height) !== (tw > th) && tw !== th) { // this Chrome applies the size before rotating
    bm.close();
    bm = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth: th, resizeHeight: tw, resizeQuality: 'high' });
  }
  return { src: bm, w: bm.width, h: bm.height, free: () => bm.close() };
}

// Full-size decode. createImageBitmap decodes off the main thread; <img> is the fallback.
async function decodeBitmap(file) {
  const bm = await createImageBitmap(file, { imageOrientation: 'from-image' });
  return { src: bm, w: bm.width, h: bm.height, free: () => bm.close() };
}
function decodeImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    const free = () => { img.removeAttribute('src'); URL.revokeObjectURL(url); };
    img.onload = () => resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight, free });
    img.onerror = () => { free(); reject(new Error('decode failed')); };
    img.src = url;
  });
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns a canvas of at most WORK_MAX px (the photo, upright) and a release() to free it.
export async function loadImage(file) {
  let full = null;
  const tries = typeof createImageBitmap === 'function' ? [decodeScaled, decodeBitmap, decodeImg] : [decodeImg];
  for (let round = 0; round < 2 && !full; round++) {
    if (round) await pause(600); // give the phone a moment to free memory, then try once more
    for (const t of tries) { try { full = await t(file); break; } catch (_) { full = null; /* next way */ } }
  }
  if (!full || !full.w || !full.h) { if (full) full.free(); throw new Error(unreadableReason(file)); }
  try {
    const k = Math.min(1, WORK_MAX / Math.max(full.w, full.h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(full.w * k));
    c.height = Math.max(1, Math.round(full.h * k));
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full.src, 0, 0, c.width, c.height);
    return { img: c, w: c.width, h: c.height, release: () => { c.width = c.height = 0; } };
  } finally { full.free(); }
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

// Both saved copies of a photo (timeline thumbnail + display copy), made from an opened photo.
export async function makeCopies(L, crop) {
  const thumb = await makeThumb(L.img, L.w, L.h, crop);
  const disp = await makeDisplay(L.img, L.w, L.h);
  return { thumb, display: disp.blob, width: disp.width, height: disp.height };
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
