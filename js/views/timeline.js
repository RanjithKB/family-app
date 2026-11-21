// The timeline: two lanes (one per person) that drift together at the meetups,
// come close at the engagement, merge at the wedding, then continue as one line.
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
  const mem = S.memories.filter((m) => !inOwn.has(m.id));
  const ownAt = (homes, lanes) => groupsOwn.filter((g) => homes.includes(g.home) && (!lanes || lanes.includes(g.c.lane)));
  const ownCard = (g, small) => groupCard(g.c.label, g.mems, small, 'cc-' + g.c.id, g.c);
  const byDate = (arr) => arr.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : (y.head ? 1 : 0) - (x.head ? 1 : 0)));
  const by = (ch) => mem.filter((m) => m.chapter === ch);
  const childA = mem.filter((m) => m.chapter === 'childhood' && m.lane === 'a');
  const childB = mem.filter((m) => m.chapter === 'childhood' && m.lane === 'b');
  const meetups = by('meetups'), engagement = by('engagement'), wedding = by('wedding'), married = by('married'), baby = by('baby');
  const seq = [...childA, ...childB, ...meetups, ...engagement, ...wedding, ...S.memories.filter((m) => !inOwn.has(m.id) && (m.chapter === 'married' || m.chapter === 'baby'))].map((m) => m.id);
  const W = Math.min(window.innerWidth, 520) - 40;
  const motionOff = () => document.documentElement.dataset.motion === 'off';
  const jump = (id) => { const t = document.getElementById(id); if (t) t.scrollIntoView({ behavior: motionOff() ? 'auto' : 'smooth', block: 'start' }); };

  const wd = S.settings.wedding_date;
  const top = h('div', { class: 'tl-top' },
    h('div', { class: 'row between' }, h('h1', { style: 'font-size:28px;line-height:34px' }, 'Our story'),
      h('button', { class: 'iconbtn', 'aria-label': 'Add a memory', html: ICON.plus, onClick: openAddChooser })),
    h('div', { class: 'sub' }, wd ? `${sinceLabel(wd)} since the wedding` : 'Set your wedding date in Settings'),
    h('div', { class: 'chips scroll', style: 'margin-top:10px' },
      [['Childhood', 'ch-childhood'], ['Meetups', 'ch-meetups'], ['Wedding', 'ch-wedding'], ['Baby', 'ch-baby']].map(([l, id]) => h('button', { class: 'chip' + (id === 'ch-wedding' ? ' on gold' : ''), type: 'button', onClick: () => jump(id) }, l))),
    h('div', { class: 'pills' }, h('span', { class: 'pill a' }, S.names.a), h('span', { class: 'pill b' }, S.names.b)));

  const emptyBtn = (text) => h('button', { class: 'empty', type: 'button', style: 'width:100%;background:none', onClick: openAddChooser }, text);
  const item = (m) => h('div', { class: 'item' }, card(m, seq));

  // A person's column: their memories and their own chapters, in date order.
  const colItems = (list, lane, emptyText) => {
    const entries = byDate([
      ...list.map((m) => ({ date: m.taken_on, el: () => item(m) })),
      ...ownAt(['childhood'], [lane]).map((g) => ({ date: g.date, el: () => h('div', { class: 'item' }, ownCard(g)) }))
    ]);
    return entries.length ? entries.map((e) => e.el()) : emptyBtn(emptyText);
  };

  // 1. childhood: two lanes side by side
  const childhood = h('div', { class: 'stage', id: 'ch-childhood' },
    h('div', { class: 'duo edge' }, h('div', { class: 'cols' },
      h('div', { class: 'col a' }, colItems(childA, 'a', `Add ${S.names.a}'s first photo`)),
      h('div', { class: 'col b' }, colItems(childB, 'b', `Add ${S.names.b}'s first photo`)))));

  // 2. meetups, lanes still apart, a shared card between them
  const meet = h('div', { class: 'stage', id: 'ch-meetups' },
    h('div', { class: 'duo edge', style: 'min-height:170px' },
      h('i', { class: 'dot a' }), h('i', { class: 'dot b' }), h('i', { class: 'link-l' }), h('i', { class: 'link-r' }),
      groupCard('Unofficial meetups', meetups)));
  // your own shared chapters from before the engagement sit between the two lines
  const meetOwn = ownAt(['meetups']);
  const meetMore = meetOwn.length ? h('div', { class: 'stage' }, h('div', { class: 'duo edge' }, byDate(meetOwn).map((g) => ownCard(g)))) : null;

  // 3. lanes drift in, engagement card between them, then merge
  const drift = h('div', { class: 'stage' }, curve(W, 2, W * 0.28, W - 2, W * 0.72, 80));
  const engage = h('div', { class: 'stage', id: 'ch-engagement' },
    h('div', { class: 'duo mid', style: 'min-height:150px' }, groupCard('Engagement', engagement, true), byDate(ownAt(['engagement'])).map((g) => ownCard(g, true))));
  const merge = h('div', { class: 'stage' }, curve(W, W * 0.28, W * 0.5, W * 0.72, W * 0.5, 120, 'merge'));

  // 4. wedding: swipeable carousel by event
  const weddingDate = wd || (wedding[0] && wedding[0].taken_on);
  const groups = WEDDING_EVENTS.map((ev) => ({ ev, mems: wedding.filter((m) => (m.event || 'other') === ev.id) })).filter((g) => g.mems.length);
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

  // 5. one shared line: married life, then baby
  const solo = h('div', { class: 'solo', id: 'ch-married' });
  let k = 0;
  // memories and your own chapters, in date order, alternating sides of the line
  // One date order for the whole line, whichever chapter a memory is in. "Baby arrives" sits at the baby's date.
  if (!married.length && !baby.length && !ownAt(['wedding', 'married', 'baby']).length) solo.appendChild(h('div', { style: 'padding:6px 0 18px;position:relative;z-index:2' }, emptyBtn('Your life together starts here. Add the first memory.')));
  const bd = S.settings.baby_date || (baby[0] && baby[0].taken_on);
  const babyHead = bd ? [{ date: bd, head: true, el: () => h('div', { class: 'babyhead', id: 'ch-baby' },
    h('div', { class: 'node' }), h('div', { class: 'lab' }, 'BABY ARRIVES'), h('div', null, h('span', { class: 'sub' }, `${fmtDate(bd)} · ${sinceLabel(bd)} old`))) }] : [];
  byDate([
    ...[...married, ...baby].map((m) => ({ date: m.taken_on, el: () => card(m, seq) })),
    ...ownAt(['wedding', 'married', 'baby']).map((g) => ({ date: g.date, el: () => ownCard(g) })),
    ...babyHead
  ]).forEach((e) => solo.appendChild(e.head ? e.el() : h('div', { class: 'srow ' + (k++ % 2 ? 'r' : 'l') }, h('div', { class: 'c' }, e.el()))));
  const future = h('div', { class: 'stage' }, h('div', { class: 'future' }, h('button', { class: 'btn ghost', type: 'button', onClick: openAddChooser }, '+ Add a photo or a note')));

  const tl = h('div', { class: 'tl' }, top, childhood, meet, meetMore, drift, engage, merge, wed, h('div', { class: 'stage' }, solo), future);
  root.appendChild(tl);
  if (opts.scrollTo) requestAnimationFrame(() => { const t = document.getElementById(opts.scrollTo); if (t) t.scrollIntoView({ block: 'start' }); });
}
