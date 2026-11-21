// Home: counters, "on this day", chapter rail, recently added.
import { h, lazyImg, avatar } from '../ui.js';
import { S } from '../state.js';
import { sinceLabel, fmtDate, todayISO, CHAPTERS } from '../dates.js';
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

  // counter
  const parts = [];
  if (s.wedding_date) parts.push(h('div', null, h('div', { class: 'k' }, 'MARRIED'), h('div', { class: 'v' }, sinceLabel(s.wedding_date))));
  if (s.baby_date) parts.push(h('div', { class: 'r' }, h('div', { class: 'k' }, 'BABY'), h('div', { class: 'v' }, sinceLabel(s.baby_date))));
  root.appendChild(parts.length
    ? h('div', { class: 'counter rv' }, parts)
    : h('button', { class: 'empty', type: 'button', style: 'width:100%;margin-top:16px;background:none', onClick: openSettings }, 'Set your wedding date to start the counter'));

  // on this day (same month+day, earlier year)
  const md = today.slice(5);
  const otd = mem.filter((m) => m.kind === 'photo' && m.thumb_path && m.precision === 'day' && m.taken_on.slice(5) === md && m.taken_on.slice(0, 4) < today.slice(0, 4))[0];
  if (otd) {
    const years = Number(today.slice(0, 4)) - Number(otd.taken_on.slice(0, 4));
    root.appendChild(h('button', { class: 'otd rv', type: 'button', onClick: () => openViewer(otd.id, [otd.id]) },
      h('div', { class: 'ph' }, lazyImg(otd.thumb_path, '', '')),
      h('div', { class: 'meta' }, h('div', { class: 'k' }, `ON THIS DAY · ${years} YEAR${years === 1 ? '' : 'S'} AGO`), h('div', { class: 't' }, otd.caption || fmtDate(otd.taken_on)))));
  }

  // chapter rail
  root.appendChild(h('div', { class: 'sec' }, h('h2', null, 'Chapters'), h('button', { class: 'link', type: 'button', onClick: () => goTimeline() }, 'Open timeline')));
  const target = { childhood: 'ch-childhood', meetups: 'ch-meetups', engagement: 'ch-engagement', wedding: 'ch-wedding', married: 'ch-married', baby: 'ch-baby' };
  root.appendChild(h('div', { class: 'rail' }, CHAPTERS.map((c) => {
    const list = mem.filter((m) => m.chapter === c.id);
    const cover = list.find((m) => m.kind === 'photo' && m.thumb_path);
    return h('button', { class: 'chcard' + (c.id === 'wedding' ? ' wed' : ''), type: 'button', onClick: () => goTimeline(target[c.id]) },
      h('div', { class: 'ph' }, cover ? lazyImg(cover.thumb_path, '', '') : null),
      h('div', { class: 't' }, c.label, h('small', null, `${list.length} memor${list.length === 1 ? 'y' : 'ies'}`)));
  })));

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
