// Home: celebration banner, counters, coming up, "on this day", chapter rail, recently added.
import { h, lazyImg, avatar } from '../ui.js';
import { S, ownChapterGroups } from '../state.js';
import { sinceLabel, fmtDate, todayISO, parseISO, CHAPTERS } from '../dates.js';
import { specialDays, inDays } from '../special.js';
import { store } from '../store.js';
import { openViewer } from './viewer.js';
import { openAddChooser } from './add.js';

export function renderHome(root, { goTimeline, openSettings }) {
  root.className = 'screen';
  while (root.firstChild) root.removeChild(root.firstChild);
  const mem = S.memories;
  const s = S.settings;
  const today = todayISO();

  root.appendChild(h('div', { class: 'row between' },
    h('div', null, h('div', { class: 'small muted' }, 'Hello'), h('h1', { style: 'font-size:28px;line-height:34px' }, `${S.names.a} & ${S.names.b}`)),
    h('button', { class: 'iconbtn', 'aria-label': 'Settings', onClick: openSettings }, '⚙️')));

  // birthdays and anniversaries (both of you see these; wording depends on who is signed in)
  const events = specialDays(s, S.names, store.me ? store.me.lane : 'a', today);
  const todays = events.filter((e) => e.days === 0);
  const md = today.slice(5);
  const pastToday = mem.filter((m) => m.kind === 'photo' && m.thumb_path && m.precision === 'day' && m.taken_on.slice(5) === md && m.taken_on.slice(0, 4) < today.slice(0, 4));
  todays.forEach((e, i) => root.appendChild(celebration(e, i === 0 ? pastToday : [])));

  // counter
  const parts = [];
  if (s.wedding_date) parts.push(h('div', null, h('div', { class: 'k' }, 'MARRIED'), h('div', { class: 'v' }, sinceLabel(s.wedding_date))));
  if (s.baby_date) parts.push(h('div', { class: 'r' }, h('div', { class: 'k' }, 'BABY'), h('div', { class: 'v' }, sinceLabel(s.baby_date))));
  root.appendChild(parts.length
    ? h('div', { class: 'counter rv' }, parts)
    : h('button', { class: 'empty', type: 'button', style: 'width:100%;margin-top:16px;background:none', onClick: openSettings }, 'Set your wedding date to start the counter'));

  // coming up: the next 30 days, or at least the next one
  const soon = events.filter((e) => e.days > 0 && e.days <= 30);
  const next = soon.length ? soon.slice(0, 3) : events.filter((e) => e.days > 0).slice(0, 1);
  if (next.length) {
    root.appendChild(h('div', { class: 'upcoming rv' }, h('div', { class: 'k' }, 'COMING UP'),
      next.map((e) => h('div', { class: 'ev' }, h('span', { class: 'em', 'aria-hidden': 'true' }, e.emoji),
        h('div', { style: 'min-width:0' }, h('div', { class: 't' }, e.title), h('div', { class: 'd' }, `${e.line} · ${parseISO(e.occ).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`)),
        h('span', { class: 'n' }, inDays(e.days))))));
  }

  // on this day (same month+day, earlier year); on a celebration day those photos are in the banner
  const otd = todays.length ? null : pastToday[0];
  if (otd) {
    const years = Number(today.slice(0, 4)) - Number(otd.taken_on.slice(0, 4));
    root.appendChild(h('button', { class: 'otd rv', type: 'button', onClick: () => openViewer(otd.id, [otd.id]) },
      h('div', { class: 'ph' }, lazyImg(otd.thumb_path, '', '')),
      h('div', { class: 'meta' }, h('div', { class: 'k' }, `ON THIS DAY · ${years} YEAR${years === 1 ? '' : 'S'} AGO`), h('div', { class: 't' }, otd.caption || fmtDate(otd.taken_on)))));
  }

  // chapter rail
  root.appendChild(h('div', { class: 'sec' }, h('h2', null, 'Chapters'), h('button', { class: 'link', type: 'button', onClick: () => goTimeline() }, 'Open timeline')));
  const target = { childhood: 'ch-childhood', meetups: 'ch-meetups', engagement: 'ch-engagement', wedding: 'ch-wedding', married: 'ch-married', baby: 'ch-baby' };
  const own = ownChapterGroups().sort((x, y) => (x.date < y.date ? -1 : 1));
  const inOwn = new Set(own.flatMap((g) => g.mems.map((m) => m.id)));
  const chCard = (label, list, to, cls = '') => {
    const cover = list.find((m) => m.kind === 'photo' && m.thumb_path);
    return h('button', { class: 'chcard' + cls, type: 'button', onClick: () => goTimeline(to) },
      h('div', { class: 'ph' }, cover ? lazyImg(cover.thumb_path, '', '') : null),
      h('div', { class: 't' }, label, h('small', null, `${list.length} memor${list.length === 1 ? 'y' : 'ies'}`)));
  };
  root.appendChild(h('div', { class: 'rail' },
    CHAPTERS.map((c) => chCard(c.label, mem.filter((m) => m.chapter === c.id && !inOwn.has(m.id)), target[c.id], c.id === 'wedding' ? ' wed' : '')),
    own.map((g) => chCard(g.c.label, g.mems, 'cc-' + g.c.id, ' own'))));

  // recent
  const recent = mem.slice().sort((x, y) => (y.created_at || '').localeCompare(x.created_at || '')).slice(0, 9);
  root.appendChild(h('div', { class: 'sec' }, h('h2', null, 'Recently added')));
  if (!recent.length) {
    root.appendChild(h('button', { class: 'empty', type: 'button', style: 'width:100%;background:none', onClick: openAddChooser }, 'Nothing yet. Add your first memory.'));
  } else {
    const ids = recent.map((m) => m.id);
    root.appendChild(h('div', { class: 'recent' }, recent.map((m) => {
      const lane = (S.members.find((x) => x.id === m.created_by) || {}).lane || m.lane;
      const nm = lane === 'b' ? S.names.b : S.names.a;
      return h('button', { class: 'tile rv', type: 'button', 'aria-label': m.caption || 'Memory', onClick: () => openViewer(m.id, ids), style: m.kind === 'note' ? 'background:#FBEFD2;font-size:28px' : null },
        m.kind === 'note' ? (m.note_emoji || '💬') : lazyImg(m.thumb_path, '', ''),
        avatar(nm, lane === 'b' ? 'b' : 'a'));
    })));
  }
}

// Today's celebration: big wish, light confetti (smooth motion only), photos from this day in past years.
function celebration(e, past) {
  const colors = ['#E8A33D', '#C2466A', '#1F7A8C', '#7A5CC2', '#3E9A5B'];
  const confetti = h('div', { class: 'confetti', 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) =>
    h('i', { style: `left:${4 + i * 6.8}%;background:${colors[i % colors.length]};animation-delay:${(i % 5) * 0.12}s` })));
  const ids = past.map((m) => m.id);
  return h('div', { class: 'celebrate rv' }, confetti,
    h('div', { class: 'em', 'aria-hidden': 'true' }, e.emoji),
    h('h2', null, e.today),
    h('div', { class: 'sub' }, e.line),
    past.length ? h('div', { class: 'past' }, past.slice(0, 4).map((m) => h('button', { type: 'button', 'aria-label': `${m.caption || 'Photo'}, ${fmtDate(m.taken_on)}`, onClick: () => openViewer(m.id, ids) }, lazyImg(m.thumb_path, '', '')))) : null,
    past.length ? h('div', { class: 'small muted', style: 'margin-top:6px' }, 'This day in past years') : null,
    h('button', { class: 'btn ghost sm', type: 'button', onClick: openAddChooser }, 'Add a memory for today'));
}
