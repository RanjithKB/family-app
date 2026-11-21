// Adding memories: chooser, photo crop, details + upload, notes, and editing.
import { h, page, sheet, closeAllLayers, toast, ICON, EMOJIS, clear, lazyImg } from '../ui.js';
import { store } from '../store.js';
import { S, reload, laneName, mine } from '../state.js';
import { CHAPTERS, WEDDING_EVENTS, PRECISIONS, NOTE_COLORS, todayISO, normalizeDate, suggestChapter, fmtDate } from '../dates.js';
import { loadImage, makeCopies, photoDateISO } from '../images.js';

const lanes = () => [
  { id: 'a', label: S.names.a, cls: '' },
  { id: 'b', label: S.names.b, cls: 'l-b' },
  { id: 'together', label: 'Together', cls: 'gold' }
];

// ------------------------------------------------------------------ chooser
export function openAddChooser() {
  let close;
  const opt = (icon, bg, fg, title, desc, onClick, hl) =>
    h('button', { class: 'opt' + (hl ? ' hl' : ''), type: 'button', onClick },
      h('span', { class: 'ic', style: `background:${bg};color:${fg}`, html: icon }),
      h('span', null, h('b', null, title), h('span', { class: 'd' }, desc)));

  const pick = (capture) => {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: !capture, capture: capture ? 'environment' : null, style: 'display:none' });
    input.addEventListener('change', () => {
      const files = [...input.files];
      input.remove();
      if (files.length) startPhotos(files);
    });
    document.body.appendChild(input);
    input.click();
    close();
  };

  close = sheet('Add to our story', h('div', null,
    opt(ICON.image, '#CFE5EA', '#0F4A57', 'Photos', 'Pick from your gallery, many at once', () => pick(false)),
    opt(ICON.camera, '#D6E6D3', '#2D5E29', 'Take a photo', 'Open the camera right now', () => pick(true)),
    opt(ICON.pen, '#D9922B', '#1D2540', 'Write a note', 'Words and emojis, no photo needed', () => { close(); setTimeout(() => openNoteForm(null), 60); }, true)));
}

// Photos shared from the Android gallery (see sw.js)
export async function takeSharedFiles() {
  try {
    const cache = await caches.open('shared-files');
    const files = [];
    for (const k of await cache.keys()) {
      const r = await cache.match(k);
      const b = await r.blob();
      files.push(new File([b], decodeURIComponent(r.headers.get('X-Name') || 'photo.jpg'), { type: b.type || 'image/jpeg', lastModified: Number(r.headers.get('X-Modified')) || Date.now() }));
      await cache.delete(k);
    }
    return files;
  } catch (_) { return []; }
}

export function startPhotos(files) {
  const imgs = files.filter((f) => !f.type || f.type.startsWith('image/'));
  if (!imgs.length) { toast('No photos found'); return; }
  cropFlow(imgs);
}

// ------------------------------------------------------------------ date field (shared)
function dateField({ iso = todayISO(), precision = 'day', photoMode = false }) {
  let mode = photoMode ? 'photo' : precision;
  const val = { day: iso, month: iso.slice(0, 7), year: iso.slice(0, 4), around: iso.slice(0, 4) };
  const chips = h('div', { class: 'chips' });
  const box = h('div', { style: 'margin-top:10px' });
  const modes = (photoMode ? [{ id: 'photo', label: "Photo's own date" }] : []).concat(PRECISIONS);
  const api = { el: h('div', null, chips, box), onChange: null };
  function draw() {
    clear(chips); clear(box);
    modes.forEach((m) => chips.appendChild(h('button', { type: 'button', class: 'chip' + (m.id === mode ? ' on' : ''), onClick: () => { mode = m.id; draw(); if (api.onChange) api.onChange(); } }, m.label)));
    if (mode === 'photo') { box.appendChild(h('div', { class: 'hint' }, 'Each photo uses the date your phone saved. You can change it later.')); return; }
    const type = mode === 'day' ? 'date' : mode === 'month' ? 'month' : 'number';
    const inp = h('input', { class: 'input', type, value: val[mode], 'aria-label': 'Date', min: type === 'number' ? '1900' : null, max: type === 'number' ? '2100' : null, inputmode: type === 'number' ? 'numeric' : null });
    inp.addEventListener('input', () => { val[mode] = inp.value; if (api.onChange) api.onChange(); });
    box.appendChild(inp);
    if (mode === 'around') box.appendChild(h('div', { class: 'hint' }, 'For old scans with no date, a rough year is fine.'));
  }
  api.get = () => {
    if (mode === 'photo') return { photo: true };
    let d;
    if (mode === 'day') d = val.day || todayISO();
    else if (mode === 'month') d = (val.month || todayISO().slice(0, 7)) + '-01';
    else d = `${val.year || todayISO().slice(0, 4)}-01-01`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) d = todayISO();
    return { iso: normalizeDate(d, mode), precision: mode };
  };
  draw();
  return api;
}

const field = (label, ...kids) => h('div', { class: 'field' }, h('span', { class: 'lbl' }, label), ...kids);

// ------------------------------------------------------------------ crop
function cropFlow(files) {
  const items = files.map((file) => ({ file, crop: null }));
  const holder = h('div', { class: 'inner' });
  const { el, close } = page(holder);
  el.classList.add('crop-dark');
  let idx = 0, current = null;

  const cleanup = () => { if (current) { current.release(); current = null; } };

  async function show(i) {
    idx = i;
    clear(holder);
    holder.appendChild(h('div', { class: 'pagebar' },
      h('button', { class: 'iconbtn', 'aria-label': 'Close', html: ICON.close, onClick: () => { cleanup(); close(); } }),
      h('h2', null, files.length > 1 ? `Crop photo ${i + 1} of ${files.length}` : 'Crop photo'),
      h('span', { style: 'width:44px' })));
    holder.appendChild(h('p', { class: 'small', style: 'color:#B8BED2;margin:8px 0 0' }, 'Drag and pinch to choose what shows on the timeline'));
    const loading = h('div', { class: 'cropbox sk', style: 'width:300px;height:375px' });
    holder.appendChild(loading);
    let L;
    try { L = await loadImage(items[i].file); } catch (e) { items[i].bad = e.message; next(); return; }
    cleanup(); current = L;
    const fw = Math.min(innerWidth - 40, 340), fh = fw * 1.25;
    const st = { mode: 'fill', s: 1, tx: 0, ty: 0 };
    const image = L.img; // the small working copy, shown directly (no second decode)
    image.className = 'cropimg';
    image.setAttribute('aria-hidden', 'true');
    image.style.cssText = `width:${L.w}px;height:${L.h}px`;
    const box = h('div', { class: 'cropbox', style: `width:${fw}px;height:${fh}px` }, image, h('div', { class: 'grid' }));
    const minS = () => (st.mode === 'fill' ? Math.max(fw / L.w, fh / L.h) : Math.min(fw / L.w, fh / L.h));
    const apply = () => {
      const sw = L.w * st.s, sh = L.h * st.s;
      st.tx = sw <= fw ? (fw - sw) / 2 : Math.min(0, Math.max(fw - sw, st.tx));
      st.ty = sh <= fh ? (fh - sh) / 2 : Math.min(0, Math.max(fh - sh, st.ty));
      image.style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`;
    };
    const reset = () => { st.s = minS(); st.tx = (fw - L.w * st.s) / 2; st.ty = (fh - L.h * st.s) / 2; apply(); };
    reset();

    const pts = new Map();
    let pinch = null;
    box.addEventListener('pointerdown', (e) => {
      box.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [p, q] = [...pts.values()];
        const r = box.getBoundingClientRect();
        const cx = (p.x + q.x) / 2 - r.left, cy = (p.y + q.y) / 2 - r.top;
        pinch = { d: Math.hypot(p.x - q.x, p.y - q.y), s: st.s, px: (cx - st.tx) / st.s, py: (cy - st.ty) / st.s };
      }
    });
    box.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      if (pts.size === 1) {
        st.tx += e.clientX - prev.x; st.ty += e.clientY - prev.y;
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        apply();
      } else if (pts.size === 2 && pinch) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [p, q] = [...pts.values()];
        const r = box.getBoundingClientRect();
        const cx = (p.x + q.x) / 2 - r.left, cy = (p.y + q.y) / 2 - r.top;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        const lo = minS();
        st.s = Math.min(lo * 5, Math.max(lo, pinch.s * (d / pinch.d)));
        st.tx = cx - pinch.px * st.s; st.ty = cy - pinch.py * st.s;
        apply();
      }
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = box.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
      const px = (cx - st.tx) / st.s, py = (cy - st.ty) / st.s, lo = minS();
      st.s = Math.min(lo * 5, Math.max(lo, st.s * (e.deltaY < 0 ? 1.1 : 0.9)));
      st.tx = cx - px * st.s; st.ty = cy - py * st.s; apply();
    }, { passive: false });

    const seg = h('div', { class: 'seg' });
    const drawSeg = () => {
      clear(seg);
      for (const m of [['fill', 'Fill'], ['fit', 'Fit']]) seg.appendChild(h('button', { type: 'button', class: st.mode === m[0] ? 'on' : '', onClick: () => { st.mode = m[0]; reset(); drawSeg(); } }, m[1]));
    };
    drawSeg();

    holder.replaceChild(box, loading);
    holder.appendChild(h('div', { class: 'row between', style: 'width:100%;max-width:340px;margin-top:14px;gap:12px' },
      seg, h('span', { class: 'small', style: 'color:#B8BED2;text-align:right' }, 'Fill crops to the frame.', h('br'), 'Fit keeps the whole photo.')));
    holder.appendChild(h('p', { class: 'small', style: 'color:#B8BED2;max-width:340px;margin-top:12px' }, 'The full photo is always saved and opens in the photo view. Only the timeline thumbnail is cropped.'));

    const last = i === items.length - 1;
    holder.appendChild(h('div', { class: 'stickybar' },
      h('button', { class: 'btn ghost', style: 'flex:0 0 auto', type: 'button', onClick: async (e) => { busy(e); items[i].crop = null; if (!last) { items.slice(i + 1).forEach((x) => (x.crop = null)); } await keep(i); cleanup(); details(); } }, last ? 'Skip crop' : 'Auto-crop rest'),
      h('button', { class: 'btn gold', type: 'button', onClick: async (e) => { busy(e); items[i].crop = { s: st.s, tx: st.tx, ty: st.ty, frameW: fw, mode: st.mode }; await keep(i); next(); } }, last ? 'Next' : 'Next photo')));
  }
  const busy = (e) => { e.currentTarget.closest('.stickybar').querySelectorAll('button').forEach((b) => (b.disabled = true)); };
  // The photo is open right now: make its saved copies straight away, so saving never has to open
  // the big original again (that second open is what failed on phones short of memory).
  async function keep(i) {
    if (!current) return;
    try { items[i].ready = await makeCopies(current, items[i].crop); } catch (_) { /* saving will open it again */ }
  }
  function next() { cleanup(); if (idx + 1 < items.length) show(idx + 1); else details(); }

  async function details() {
    await Promise.all(items.map(async (x) => { if (!x.bad) x.date = await photoDateISO(x.file); }));
    const ok = items.filter((x) => !x.bad);
    const bad = items.filter((x) => x.bad);
    if (!ok.length) { cleanup(); close(); toast(bad.length > 1 ? `None of these photos could be opened. ${bad[0].bad}` : bad[0].bad, 8000); return; }
    if (bad.length) toast(`${bad.length} photo${bad.length > 1 ? 's' : ''} skipped. ${bad[0].bad}`, 8000);
    openDetails(ok, () => { cleanup(); });
  }
  show(0);
}

// ------------------------------------------------------------------ details + upload
function openDetails(items, onDone) {
  const settings = S.settings;
  const form = { lane: store.me.lane, chapter: null, chapterTouched: false, custom: null, event: 'ceremony', people: [] };
  const df = dateField({ photoMode: true });
  const firstDate = items[0].date;
  const holder = h('div', { class: 'inner' });
  const { el, close } = page(holder);

  const dateNow = () => { const g = df.get(); return g.photo ? firstDate : g.iso; };
  const auto = () => suggestChapter(form.lane, dateNow(), settings);
  form.chapter = auto();

  const cap = h('input', { class: 'input', type: 'text', maxlength: '140', placeholder: 'Add a caption, or skip', 'aria-label': 'Caption' });
  const laneRow = h('div', { class: 'chips' });
  const chRow = h('div', { class: 'chips' });
  const evBox = h('div');
  const people = h('input', { class: 'input', type: 'text', placeholder: 'e.g. Amma, Appa', 'aria-label': 'Who is in it' });

  const draw = () => {
    if (!form.chapterTouched) form.chapter = auto();
    clear(laneRow);
    lanes().forEach((l) => laneRow.appendChild(h('button', { type: 'button', class: 'chip' + (form.lane === l.id ? ` on ${l.cls}` : ''), onClick: () => { form.lane = l.id; if (form.custom && (S.chapters.find((c) => c.id === form.custom) || {}).lane !== l.id) form.custom = null; draw(); } }, l.label)));
    clear(chRow);
    CHAPTERS.forEach((c) => {
      const disabled = c.id === 'childhood' ? form.lane === 'together' : form.lane !== 'together' && c.id !== 'childhood' && dateNow() < (settings.wedding_date || '0000');
      chRow.appendChild(h('button', { type: 'button', class: 'chip' + (!form.custom && form.chapter === c.id ? ' on gold' : ''), disabled: disabled && form.chapter !== c.id, onClick: () => { form.custom = null; form.chapter = c.id; form.chapterTouched = true; draw(); } }, c.label));
    });
    // Your own chapters for this line, then a way to make a new one.
    S.chapters.filter((c) => c.lane === form.lane).forEach((c) => chRow.appendChild(h('button', { type: 'button', class: 'chip' + (form.custom === c.id ? ' on gold' : ''), onClick: () => { form.custom = c.id; form.chapterTouched = false; draw(); } }, c.label)));
    chRow.appendChild(h('button', { type: 'button', class: 'chip add', onClick: () => newChapterSheet(form.lane, (c) => { form.custom = c.id; form.chapterTouched = false; draw(); }) }, '+ New chapter'));
    clear(evBox);
    if (!form.custom && form.chapter === 'wedding') {
      const row = h('div', { class: 'chips' });
      WEDDING_EVENTS.forEach((ev) => row.appendChild(h('button', { type: 'button', class: 'chip' + (form.event === ev.id ? ' on gold' : ''), onClick: () => { form.event = ev.id; draw(); } }, ev.label)));
      evBox.appendChild(field('Which wedding event?', row));
    }
  };
  df.onChange = draw;

  const known = [...new Set(S.memories.flatMap((m) => m.people || []))].slice(0, 6);
  const sugg = h('div', { class: 'chips', style: 'margin-top:8px' });
  known.forEach((n) => sugg.appendChild(h('button', { type: 'button', class: 'chip', onClick: () => { const cur = people.value.split(',').map((s) => s.trim()).filter(Boolean); if (!cur.includes(n)) cur.push(n); people.value = cur.join(', '); } }, '+ ' + n)));

  holder.appendChild(h('div', { class: 'pagebar' },
    h('button', { class: 'iconbtn', 'aria-label': 'Back', html: ICON.back, onClick: close }),
    h('h2', null, `Memory details${items.length > 1 ? ` (${items.length} photos)` : ''}`),
    h('span', { style: 'width:44px' })));
  holder.appendChild(field(items.length > 1 ? 'Caption for all (optional)' : 'Caption (optional)', cap));
  holder.appendChild(field('Whose line does this belong to?', laneRow, h('div', { class: 'hint' }, 'Together is for meetups and everything after the wedding.')));
  holder.appendChild(field('Chapter', chRow));
  holder.appendChild(evBox);
  holder.appendChild(field('When was it?', df.el));
  holder.appendChild(field('Who is in it? (optional)', people, known.length ? sugg : null));
  const save = h('button', { class: 'btn', type: 'button' }, 'Save to timeline');
  holder.appendChild(h('div', { class: 'stickybar' }, save));
  draw();

  save.addEventListener('click', async () => {
    save.disabled = true;
    const prog = h('i');
    const msg = h('div', { class: 'small muted' }, 'Getting ready…');
    const box = h('div', { class: 'dialog-wrap' }, h('div', { class: 'backdrop on' }),
      h('div', { class: 'dialog' }, h('h3', null, 'Adding to your story'), msg, h('div', { class: 'progress' }, prog)));
    document.body.appendChild(box);
    const g = df.get();
    const ppl = people.value.split(',').map((s) => s.trim()).filter(Boolean);
    let done = 0;
    const skipped = [];
    try {
      for (const it of items) {
        msg.textContent = `Photo ${done + skipped.length + 1} of ${items.length}`;
        let copies = it.ready;
        if (!copies) { // not opened on the crop screen (auto-crop): open it now
          let L;
          try { L = await loadImage(it.file); } catch (e) { skipped.push(e.message); continue; }
          try { copies = await makeCopies(L, it.crop); } catch (e) { skipped.push(e.message); continue; } finally { L.release(); }
        }
        {
          const iso = g.photo ? it.date : g.iso;
          const chapter = form.chapterTouched ? form.chapter : suggestChapter(form.lane, iso, settings);
          const rec = {
            kind: 'photo', lane: form.lane, chapter, event: !form.custom && chapter === 'wedding' ? form.event : null,
            ...(form.custom ? { custom_chapter: form.custom } : {}),
            caption: cap.value.trim() || null, taken_on: iso, precision: g.photo ? 'day' : g.precision,
            people: ppl, width: copies.width, height: copies.height
          };
          await store.addMemory(rec, { thumb: copies.thumb, display: copies.display });
          it.ready = null; // let the copies go once uploaded
        }
        done++;
        prog.style.width = Math.round(((done + skipped.length) / items.length) * 100) + '%';
      }
      if (!done) {
        box.remove();
        save.disabled = false;
        toast(skipped[0], 8000);
        return;
      }
      await reload();
      box.remove();
      closeAllLayers();
      if (onDone) onDone();
      const added = done === 1 ? 'Added to your story' : `Added ${done} photos`;
      toast(skipped.length ? `${added}. ${skipped.length} skipped: ${skipped[0]}` : added, skipped.length ? 8000 : 2600);
    } catch (e) {
      box.remove();
      save.disabled = false;
      await reload().catch(() => {});
      toast(done ? `Added ${done}. Stopped: ${e.message || 'upload failed'}` : `Could not add: ${e.message || 'upload failed'}`, 5000);
    }
  });
}

// ------------------------------------------------------------------ new chapter
export function newChapterSheet(lane, onCreated) {
  let close;
  const name = h('input', { class: 'input', type: 'text', maxlength: '40', placeholder: 'e.g. College, First home, Road trips', 'aria-label': 'Chapter name', enterkeyhint: 'done' });
  const create = h('button', { class: 'btn gold block', type: 'button', style: 'margin-top:18px' }, 'Create chapter');
  const where = lane === 'together' ? 'your shared line' : `${laneName(lane)}'s line`;
  const go = async () => {
    const label = name.value.trim().replace(/\s+/g, ' ');
    if (!label) { toast('Give the chapter a name'); name.focus(); return; }
    const same = S.chapters.find((c) => c.lane === lane && c.label.toLowerCase() === label.toLowerCase());
    if (same) { close(); onCreated(same); return; }
    if (CHAPTERS.some((c) => c.label.toLowerCase() === label.toLowerCase())) { toast(`"${label}" is already a chapter. Pick it from the list.`, 4000); return; }
    create.disabled = true;
    try {
      const c = await store.addChapter({ label, lane });
      S.chapters.push(c);
      close();
      onCreated(c);
      toast(`Chapter "${label}" created`);
    } catch (e) { create.disabled = false; toast('Could not create the chapter: ' + (e.message || 'error'), 5000); }
  };
  create.addEventListener('click', go);
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  close = sheet('New chapter', h('div', null,
    field('Chapter name', name, h('div', { class: 'hint' }, `It goes on ${where}, placed by the dates of its memories. You can rename or delete it in Settings.`)),
    create));
  setTimeout(() => name.focus(), 250);
}

// ------------------------------------------------------------------ choose memories for a chapter
// Tick memories to put them in the chapter, untick to take them out. Only memories you added on
// the chapter's line can be moved (the app's rule: only the author changes a memory).
export function openChapterPicker(ch, onDone) {
  const pool = S.memories.filter((m) => m.lane === ch.lane && mine(m));
  const others = S.memories.filter((m) => m.lane === ch.lane && !mine(m) && m.custom_chapter !== ch.id).length;
  const start = new Set(pool.filter((m) => m.custom_chapter === ch.id).map((m) => m.id));
  const sel = new Set(start);
  const nameOf = (id) => (S.chapters.find((c) => c.id === id) || {}).label;
  const holder = h('div', { class: 'inner' });
  const { close } = page(holder);
  const saveBtn = h('button', { class: 'btn gold', type: 'button' });
  const count = h('div', { class: 'small muted', style: 'margin-top:4px' });
  const refresh = () => {
    const add = [...sel].filter((id) => !start.has(id)).length, rem = [...start].filter((id) => !sel.has(id)).length;
    count.textContent = `${sel.size} selected`;
    saveBtn.textContent = add || rem ? `Save${add ? ` · add ${add}` : ''}${rem ? ` · remove ${rem}` : ''}` : 'Save';
    saveBtn.disabled = !add && !rem;
  };
  const grid = h('div', { class: 'gridlist pick' }, pool.slice().reverse().map((m) => {
    const elsewhere = m.custom_chapter && m.custom_chapter !== ch.id ? nameOf(m.custom_chapter) : null;
    const c = NOTE_COLORS[m.note_color] || NOTE_COLORS.gold;
    const tile = h('button', { class: 'tile' + (sel.has(m.id) ? ' on' : ''), type: 'button', 'aria-pressed': sel.has(m.id) ? 'true' : 'false',
      'aria-label': `${m.caption || (m.kind === 'note' ? 'Note' : 'Photo')}, ${fmtDate(m.taken_on, m.precision)}${elsewhere ? ', in ' + elsewhere : ''}`,
      style: m.kind === 'note' ? `background:${c.bg};font-size:30px` : null,
      onClick: () => {
        if (sel.has(m.id)) sel.delete(m.id); else sel.add(m.id);
        tile.classList.toggle('on', sel.has(m.id));
        tile.setAttribute('aria-pressed', sel.has(m.id) ? 'true' : 'false');
        refresh();
      } },
      m.kind === 'note' ? (m.note_emoji || '💬') : lazyImg(m.thumb_path, '', ''),
      h('span', { class: 'chk', 'aria-hidden': 'true', html: ICON.check }),
      h('span', { class: 'when' }, elsewhere ? `${fmtDate(m.taken_on, m.precision === 'day' ? 'month' : m.precision)} · ${elsewhere}` : fmtDate(m.taken_on, m.precision === 'day' ? 'month' : m.precision)));
    return tile;
  }));
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const add = [...sel].filter((id) => !start.has(id)), rem = [...start].filter((id) => !sel.has(id));
    try {
      await store.setChapter(add, ch.id);
      await store.setChapter(rem, null);
      await reload();
      close();
      toast(`${ch.label}: ${sel.size} memor${sel.size === 1 ? 'y' : 'ies'}`);
      if (onDone) onDone();
    } catch (e) { refresh(); toast('Could not save: ' + (e.message || 'error'), 5000); }
  });
  holder.appendChild(h('div', { class: 'pagebar' },
    h('button', { class: 'iconbtn', 'aria-label': 'Back', html: ICON.back, onClick: close }),
    h('h2', null, ch.label),
    h('span', { style: 'width:44px' })));
  holder.appendChild(count);
  holder.appendChild(h('div', { class: 'hint' }, `Tap to put a memory in this chapter, or tap again to take it out. Showing what you added on ${ch.lane === 'together' ? 'your shared line' : laneName(ch.lane) + "'s line"}, newest first.${others ? ` ${others} added by ${ch.lane === 'together' ? 'your partner' : laneName(ch.lane)} can only be moved by them.` : ''}`));
  holder.appendChild(pool.length ? grid : h('div', { class: 'empty', style: 'margin-top:16px' }, 'Nothing you added on this line yet.'));
  holder.appendChild(h('div', { class: 'stickybar' }, saveBtn));
  refresh();
}

// ------------------------------------------------------------------ notes
export function openNoteForm(existing) {
  const editing = !!existing;
  const st = {
    text: existing ? existing.caption || '' : '',
    emojis: existing && existing.note_emoji ? splitEmoji(existing.note_emoji) : [],
    color: (existing && existing.note_color) || 'gold',
    lane: existing ? existing.lane : 'together',
    date: existing ? existing.taken_on : todayISO()
  };
  const holder = h('div', { class: 'inner' });
  const { close } = page(holder);

  const ta = h('textarea', { class: 'input', maxlength: '280', placeholder: 'A funny thing she said, a small win, a quiet moment', 'aria-label': 'Note text' });
  ta.value = st.text;
  const count = h('div', { class: 'hint', style: 'text-align:right' });
  const emRow = h('div', { class: 'emrow' });
  const swRow = h('div', { class: 'swatches' });
  const laneRow = h('div', { class: 'chips' });
  const prev = h('div');
  const dateIn = h('input', { class: 'input', type: 'date', value: st.date, 'aria-label': 'Date' });
  dateIn.addEventListener('input', () => { st.date = dateIn.value || todayISO(); drawPrev(); });

  function drawPrev() {
    const c = NOTE_COLORS[st.color];
    clear(prev);
    prev.appendChild(h('div', { class: 'ncard', style: `background:${c.bg};border-color:${c.border};width:200px` },
      h('div', { class: 'em' }, st.emojis.join('') || '💬'),
      h('div', { class: 'nt' }, st.text || '[Your note appears here]'),
      h('div', { class: 'dt' }, h('span', null, `${fmtDate(st.date)} · ${laneName(st.lane)}`))));
  }
  function draw() {
    count.textContent = `${st.text.length} / 280`;
    clear(emRow);
    EMOJIS.forEach((e) => emRow.appendChild(h('button', { type: 'button', 'aria-label': 'Emoji ' + e, class: st.emojis.includes(e) ? 'on' : '', onClick: () => { st.emojis = st.emojis.includes(e) ? st.emojis.filter((x) => x !== e) : [...st.emojis, e].slice(-3); draw(); } }, e)));
    clear(swRow);
    Object.entries(NOTE_COLORS).forEach(([k, c]) => swRow.appendChild(h('button', { type: 'button', 'aria-label': 'Colour ' + k, class: 'sw' + (st.color === k ? ' on' : ''), style: `background:${c.bg}`, onClick: () => { st.color = k; draw(); } })));
    clear(laneRow);
    lanes().forEach((l) => laneRow.appendChild(h('button', { type: 'button', class: 'chip' + (st.lane === l.id ? ` on ${l.cls}` : ''), onClick: () => { st.lane = l.id; draw(); } }, l.label)));
    drawPrev();
  }
  ta.addEventListener('input', () => { st.text = ta.value; count.textContent = `${st.text.length} / 280`; drawPrev(); });

  holder.appendChild(h('div', { class: 'pagebar' },
    h('button', { class: 'iconbtn', 'aria-label': 'Close', html: ICON.close, onClick: close }),
    h('h2', null, editing ? 'Edit note' : 'Write a note'),
    h('span', { style: 'width:44px' })));
  holder.appendChild(field('What do you want to remember?', ta, count));
  holder.appendChild(field('Add emojis (up to 3)', emRow, h('div', { class: 'hint' }, 'You can also use your keyboard’s emojis in the text.')));
  holder.appendChild(field('Card colour', swRow));
  holder.appendChild(field('Whose line?', laneRow));
  holder.appendChild(field('Date', dateIn));
  holder.appendChild(field('How it will look on the timeline', prev));
  const post = h('button', { class: 'btn', type: 'button' }, editing ? 'Save changes' : 'Post note');
  holder.appendChild(h('div', { class: 'stickybar' }, post));
  draw();

  post.addEventListener('click', async () => {
    const text = st.text.trim();
    if (!text && !st.emojis.length) { toast('Write something or pick an emoji'); return; }
    post.disabled = true;
    const chapter = suggestChapter(st.lane, st.date, S.settings);
    const rec = { lane: st.lane, chapter, caption: text || null, note_emoji: st.emojis.join('') || null, note_color: st.color, taken_on: st.date, precision: 'day' };
    try {
      if (editing) await store.updateMemory(existing.id, rec);
      else await store.addMemory({ kind: 'note', people: [], ...rec }, null);
      await reload();
      close();
      toast(editing ? 'Note updated' : 'Note posted');
    } catch (e) { post.disabled = false; toast('Could not save: ' + (e.message || 'error'), 5000); }
  });
}
function splitEmoji(s) {
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : Array.from(s);
  return seg.filter((x) => EMOJIS.includes(x) || EMOJIS.includes(x.replace(/️/g, '')) ).slice(0, 3);
}

// ------------------------------------------------------------------ edit a photo's details
export function openPhotoEdit(m, onSaved) {
  let close;
  const cap = h('input', { class: 'input', type: 'text', maxlength: '140', value: m.caption || '', placeholder: 'Add a caption, or skip', 'aria-label': 'Caption' });
  const df = dateField({ iso: m.taken_on, precision: m.precision });
  const ppl = h('input', { class: 'input', type: 'text', value: (m.people || []).join(', '), 'aria-label': 'Who is in it' });
  let custom = m.custom_chapter && S.chapters.some((c) => c.id === m.custom_chapter) ? m.custom_chapter : null;
  const chRow = h('div', { class: 'chips' });
  const drawCh = () => {
    clear(chRow);
    const usual = CHAPTERS.find((c) => c.id === m.chapter);
    chRow.appendChild(h('button', { type: 'button', class: 'chip' + (!custom ? ' on gold' : ''), onClick: () => { custom = null; drawCh(); } }, usual ? usual.label : 'Usual'));
    S.chapters.filter((c) => c.lane === m.lane).forEach((c) => chRow.appendChild(h('button', { type: 'button', class: 'chip' + (custom === c.id ? ' on gold' : ''), onClick: () => { custom = c.id; drawCh(); } }, c.label)));
    chRow.appendChild(h('button', { type: 'button', class: 'chip add', onClick: () => newChapterSheet(m.lane, (c) => { custom = c.id; drawCh(); }) }, '+ New chapter'));
  };
  drawCh();
  const save = h('button', { class: 'btn block', type: 'button', style: 'margin-top:22px' }, 'Save changes');
  save.addEventListener('click', async () => {
    save.disabled = true;
    const g = df.get();
    try {
      await store.updateMemory(m.id, {
        caption: cap.value.trim() || null, taken_on: g.iso, precision: g.precision,
        people: ppl.value.split(',').map((s) => s.trim()).filter(Boolean),
        ...((m.custom_chapter || null) !== custom ? { custom_chapter: custom } : {})
      });
      await reload();
      close();
      toast('Saved');
      if (onSaved) onSaved();
    } catch (e) { save.disabled = false; toast('Could not save: ' + (e.message || 'error'), 5000); }
  });
  close = sheet('Edit details', h('div', null, field('Caption (optional)', cap), field('Chapter', chRow), field('When was it?', df.el), field('Who is in it?', ppl), save), { tall: true });
}
