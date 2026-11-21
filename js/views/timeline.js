// The timeline, in date order top to bottom: two lanes (one per person, shared memories in the middle)
// that merge at the wedding, then one line.
import { h, page, lazyImg, ICON } from '../ui.js';
import { S, reactionInfo, laneName, ownChapterGroups } from '../state.js';
import { fmtDate, sinceLabel, WEDDING_EVENTS, NOTE_COLORS } from '../dates.js';
import { openViewer } from './viewer.js';
import { openAddChooser, openChapterPicker } from './add.js';

function topReaction(id) {
  const info = reactionInfo(id);
  let best = null;
  for (const [e, n] of Object.entries(info.counts)) if (!best || n > best[1]) best = [e, n];
  return best ? `${best[0]} ${info.total}` : '';
}

function card(m, seq) {
  const react = topReaction(m.id);
  if (m.kind === 'note') {
    const c = NOTE_COLORS[m.note_color] || NOTE_COLORS.gold;
    return h('button', { class: 'ncard rv', type: 'button', style: `background:${c.bg};border-color:${c.border}`, 'aria-label': 'Note: ' + (m.caption || ''), onClick: () => openViewer(m.id, seq) },
      m.note_emoji ? h('div', { class: 'em' }, m.note_emoji) : null,
      h('div', { class: 'nt' }, m.caption || ''),
      h('div', { class: 'dt' }, h('span', null, fmtDate(m.taken_on, m.precision)), react ? h('span', { class: 'heart' }, react) : null));
  }
  return h('button', { class: 'mcard rv', type: 'button', 'aria-label': (m.caption || 'Photo') + ', ' + fmtDate(m.taken_on, m.precision), onClick: () => openViewer(m.id, seq) },
    h('div', { class: 'ph' }, lazyImg(m.thumb_path, '', ''), react ? h('span', { class: 'badge' }, react) : null),
    h('div', { class: 'tx' }, m.caption ? h('div', { class: 'cap' }, m.caption) : null, h('div', { class: 'dt' }, fmtDate(m.taken_on, m.precision))));
}

const monthYear = (m) => fmtDate(m.taken_on, m.precision === 'year' || m.precision === 'around' ? 'year' : 'month');
function rangeLabel(mems) {
  const a = monthYear(mems[0]), b = monthYear(mems[mems.length - 1]);
  return a === b ? a : `${a} to ${b}`;
}

export function openGroup(title, mems, ch) {
  const seq = mems.map((m) => m.id);
  let close;
  const grid = h('div', { class: 'gridlist' }, mems.map((m) => {
    if (m.kind === 'note') {
      const c = NOTE_COLORS[m.note_color] || NOTE_COLORS.gold;
      return h('button', { class: 'tile', type: 'button', style: `background:${c.bg};font-size:30px`, 'aria-label': 'Note', onClick: () => openViewer(m.id, seq) }, m.note_emoji || '💬');
    }
    return h('button', { class: 'tile', type: 'button', 'aria-label': m.caption || 'Photo', onClick: () => openViewer(m.id, seq) }, lazyImg(m.thumb_path, '', ''));
  }));
  const holder = h('div', { class: 'inner' },
    h('div', { class: 'pagebar' }, h('button', { class: 'iconbtn', 'aria-label': 'Back', html: ICON.back, onClick: () => close() }), h('h2', null, title), h('span', { style: 'width:44px' })),
    h('div', { class: 'row between', style: 'margin-top:4px;gap:10px' },
      h('div', { class: 'small muted' }, `${mems.length} memor${mems.length === 1 ? 'y' : 'ies'}`),
      ch ? h('button', { class: 'btn ghost sm', type: 'button', onClick: () => openChapterPicker(ch, () => close()) }, 'Choose memories') : null),
    grid);
  close = page(holder).close;
}

function groupCard(title, mems, small, id, ch) {
  const photos = mems.filter((m) => m.kind === 'photo' && m.thumb_path);
  const strip = h('div', { class: 'strip' }, [0, 1, 2].map((i) => h('div', { class: 'ph' }, photos[i] ? lazyImg(photos[i].thumb_path, '', '') : null)));
  return h('button', { class: 'groupcard rv' + (small ? ' small' : '') + (id ? ' own' : ''), id, type: 'button', 'aria-label': title, onClick: () => (mems.length ? openGroup(title, mems, ch) : openAddChooser()) },
    strip,
    h('div', { class: 'tx' }, h('div', { class: 'cap' }, title), h('div', { class: 'dt' }, mems.length ? `${rangeLabel(mems)} · ${mems.length}` : 'Tap to add')));
}

function curve(W, fromA, toA, fromB, toB, height, cls = '') {
  const c = (x0, x1) => `M${x0} 0 C${x0} ${height * 0.62}, ${x1} ${height * 0.3}, ${x1} ${height}`;
  return h('div', { html: `<svg class="curve ${cls}" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" style="height:${height}px" aria-hidden="true"><path class="pa" pathLength="1" d="${c(fromA, toA)}"/><path class="pb" pathLength="1" d="${c(fromB, toB)}"/></svg>` });
}

export function renderTimeline(root, opts = {}) {
  root.className = '';
  while (root.firstChild) root.removeChild(root.firstChild);
  // Memories in your own chapters show inside that chapter's card instead of on their own.
  const groupsOwn = ownChapterGroups();
  const inOwn = new Set(groupsOwn.flatMap((g) => g.mems.map((m) => m.id)));
  const mem = S.memories.filter((m) => !inOwn.has(m.id)); // already in date order
  const ownCard = (g, small) => groupCard(g.c.label, g.mems, small, 'cc-' + g.c.id, g.c);
  // date order; on the same date a chapter label comes before the memories
  const byDate = (arr) => arr.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : (y.head ? 1 : 0) - (x.head ? 1 : 0)));

  // The timeline is in date order from top to bottom. Everything dated before the wedding sits above it,
  // everything after below it, whichever chapter it's in. Without any wedding date, the chapter decides.
  const wedding = mem.filter((m) => m.chapter === 'wedding');
  const wd = S.settings.wedding_date;
  const weddingDate = wd || (wedding[0] && wedding[0].taken_on) || null;
  const PRE = ['childhood', 'meetups', 'engagement'];
  const isBefore = (date, home) => (weddingDate ? !!date && date < weddingDate : PRE.includes(home));
  const before = mem.filter((m) => m.chapter !== 'wedding' && isBefore(m.taken_on, m.chapter));
  const after = mem.filter((m) => m.chapter !== 'wedding' && !isBefore(m.taken_on, m.chapter));
  const ownBefore = groupsOwn.filter((g) => isBefore(g.date, g.home));
  const ownAfter = groupsOwn.filter((g) => !ownBefore.includes(g));
  const byFirst = (x, y) => (x.mems[0].taken_on < y.mems[0].taken_on ? -1 : x.mems[0].taken_on > y.mems[0].taken_on ? 1 : 0);
  const weddingGroups = WEDDING_EVENTS.map((ev) => ({ ev, mems: wedding.filter((m) => (m.event || 'other') === ev.id) })).filter((g) => g.mems.length).sort(byFirst);
  // swiping in the photo view follows the same order as the screen
  const seq = [...before, ...weddingGroups.flatMap((g) => g.mems), ...after].map((m) => m.id);

  const W = Math.min(window.innerWidth, 520) - 40;
  const motionOff = () => document.documentElement.dataset.motion === 'off';
  const jump = (id) => { const t = document.getElementById(id); if (t) t.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'start' }); };

  const top = h('div', { class: 'tl-top' },
    h('div', { class: 'row between' }, h('h1', { style: 'font-size:28px;line-height:34px' }, 'Our story'),
      h('button', { class: 'iconbtn', 'aria-label': 'Add a memory', html: ICON.plus, onClick: openAddChooser })),
    h('div', { class: 'sub' }, wd ? `${sinceLabel(wd)} since the wedding` : 'Set your wedding date in Settings'),
    h('div', { class: 'chips scroll', style: 'margin-top:10px' },
      [['Childhood', 'ch-childhood'], ['Meetups', 'ch-meetups'], ['Wedding', 'ch-wedding'], ['Baby', 'ch-baby']].map(([l, id]) => h('button', { class: 'chip' + (id === 'ch-wedding' ? ' on gold' : ''), type: 'button', onClick: () => jump(id) }, l))),
    h('div', { class: 'pills' }, h('span', { class: 'pill a' }, S.names.a), h('span', { class: 'pill b' }, S.names.b)));

  const emptyBtn = (text) => h('button', { class: 'empty', type: 'button', style: 'width:100%;background:none', onClick: openAddChooser }, text);

  // 1. before the wedding: one list in date order. Each person's memories on their own side,
  //    shared ones (meetups, engagement) in the middle, linked to both lines.
  const side = (lane) => (lane === 'a' || lane === 'b' ? lane : 't');
  const label = (ch, text, id) => {
    const f = before.find((m) => m.chapter === ch);
    return f ? [{ date: f.taken_on, head: true, id, el: () => h('div', { class: 'phead', id }, h('span', null, `${text} · ${monthYear(f)}`)) }] : [];
  };
  const labels = [...label('meetups', 'MEETUPS', 'ch-meetups'), ...label('engagement', 'ENGAGEMENT', 'ch-engagement')];
  const preRows = byDate([
    ...before.map((m) => ({ date: m.taken_on, side: side(m.lane), el: () => card(m, seq) })),
    ...ownBefore.map((g) => ({ date: g.date, side: side(g.c.lane), el: () => ownCard(g) })),
    ...labels
  ]);
  const pre = h('div', { class: 'duo edge pre' });
  if (!before.length && !ownBefore.length) {
    pre.appendChild(h('div', { class: 'cols' },
      h('div', { class: 'col a' }, emptyBtn(`Add ${S.names.a}'s first photo`)),
      h('div', { class: 'col b' }, emptyBtn(`Add ${S.names.b}'s first photo`))));
  }
  preRows.forEach((e) => pre.appendChild(e.head ? e.el() : h('div', { class: 'prow ' + e.side }, h('div', { class: 'c' }, e.el()))));
  const childhood = h('div', { class: 'stage', id: 'ch-childhood' }, pre);
  const has = (id) => labels.some((l) => l.id === id);

  // 2. the two lines come together at the wedding
  const merge = h('div', { class: 'stage', id: has('ch-meetups') ? null : 'ch-meetups' },
    h('span', { id: has('ch-engagement') ? null : 'ch-engagement' }),
    curve(W, 2, W * 0.5, W - 2, W * 0.5, 140, 'merge'));

  // 4. wedding: swipeable carousel by event
  const groups = weddingGroups;
  const slides = h('div', { class: 'slides' });
  if (!groups.length) {
    slides.appendChild(h('button', { class: 'slide', type: 'button', onClick: openAddChooser },
      h('div', { class: 'ph' }), h('div', { class: 'tx' }, h('div', { class: 'cap' }, 'Wedding day'), h('div', { class: 'dt' }, 'Tap to add your wedding photos'))));
  }
  groups.forEach((g) => {
    const photos = g.mems.filter((m) => m.kind === 'photo' && m.thumb_path);
    slides.appendChild(h('button', { class: 'slide', type: 'button', 'aria-label': `${g.ev.label}, ${g.mems.length} memories`, onClick: () => openGroup(g.ev.label, g.mems) },
      h('div', { class: 'ph' }, photos[0] ? lazyImg(photos[0].thumb_path, '', '') : null),
      h('div', { class: 'tx' }, h('div', { class: 'cap' }, g.ev.label), h('div', { class: 'dt' }, `${fmtDate(g.mems[0].taken_on, g.mems[0].precision)} · ${g.mems.length} memor${g.mems.length === 1 ? 'y' : 'ies'}`))));
  });
  const n = Math.max(1, groups.length);
  const cnt = h('span', { class: 'cnt' }, `1 / ${n}`);
  const dots = h('div', { class: 'dots' }, Array.from({ length: n }, (_, i) => h('i', { class: i === 0 ? 'on' : '' })));
  let ticking = false;
  slides.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const i = Math.round(slides.scrollLeft / (slides.clientWidth || 1));
      cnt.textContent = `${i + 1} / ${n}`;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    });
  }, { passive: true });
  const wed = h('div', { class: 'stage', id: 'ch-wedding' },
    h('div', { class: 'wedhead' }, h('div', { class: 'node' }), h('div', { class: 'lab' }, 'WEDDING DAY' + (weddingDate ? ' · ' + fmtDate(weddingDate) : ''))),
    h('div', { class: 'carousel rv' }, slides, n > 1 ? cnt : null, n > 1 ? dots : null));

  // 5. one shared line after the wedding, in date order, alternating sides. "Baby arrives" sits at the baby's date.
  const solo = h('div', { class: 'solo', id: 'ch-married' });
  let k = 0;
  const baby = after.filter((m) => m.chapter === 'baby');
  if (!after.length && !ownAfter.length) solo.appendChild(h('div', { style: 'padding:6px 0 18px;position:relative;z-index:2' }, emptyBtn('Your life together starts here. Add the first memory.')));
  const bd = S.settings.baby_date || (baby[0] && baby[0].taken_on);
  const babyHead = bd ? [{ date: bd, head: true, el: () => h('div', { class: 'babyhead', id: 'ch-baby' },
    h('div', { class: 'node' }), h('div', { class: 'lab' }, 'BABY ARRIVES'), h('div', null, h('span', { class: 'sub' }, `${fmtDate(bd)} · ${sinceLabel(bd)} old`))) }] : [];
  byDate([
    ...after.map((m) => ({ date: m.taken_on, el: () => card(m, seq) })),
    ...ownAfter.map((g) => ({ date: g.date, el: () => ownCard(g) })),
    ...babyHead
  ]).forEach((e) => solo.appendChild(e.head ? e.el() : h('div', { class: 'srow ' + (k++ % 2 ? 'r' : 'l') }, h('div', { class: 'c' }, e.el()))));
  const future = h('div', { class: 'stage' }, h('div', { class: 'future' }, h('button', { class: 'btn ghost', type: 'button', onClick: openAddChooser }, '+ Add a photo or a note')));

  const tl = h('div', { class: 'tl' }, top, childhood, merge, wed, h('div', { class: 'stage' }, solo), future);
  root.appendChild(tl);
  if (opts.scrollTo) requestAnimationFrame(() => { const t = document.getElementById(opts.scrollTo); if (t) t.scrollIntoView({ block: 'start' }); });
}
