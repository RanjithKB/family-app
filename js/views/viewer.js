// Photo / note viewer: full photo, age label, reactions, comments, and author-only edit and delete.
import { h, page, confirmBox, toast, lazyImg, ICON, REACTIONS, clear } from '../ui.js';
import { store } from '../store.js';
import { S, byId, mine, laneName, reactionInfo, setReactionLocal, reload, onChange } from '../state.js';
import { fmtDate, chapterLabel, ageLabel, NOTE_COLORS } from '../dates.js';
import { openNoteForm, openPhotoEdit } from './add.js';

export function openViewer(startId, ids) {
  ids = (ids && ids.length ? ids : [startId]).slice();
  let idx = Math.max(0, ids.indexOf(startId));
  const holder = h('div', { class: 'viewer' });
  const { el, close } = page(holder);
  let menu = null;

  function go(d) {
    const n = idx + d;
    if (n < 0 || n >= ids.length) return;
    idx = n;
    el.scrollTop = 0;
    render();
  }

  function render() {
    const m = byId(ids[idx]);
    if (!m) { close(); return; }
    clear(holder);
    menu = null;
    const isMine = mine(m);
    const isPhoto = m.kind === 'photo';

    const menuBtn = h('button', { class: 'iconbtn' + (isPhoto ? ' dark' : ''), 'aria-label': 'More options', html: ICON.more, onClick: () => toggleMenu(m, isMine, topWrap) });
    const backBtn = h('button', { class: 'iconbtn' + (isPhoto ? ' dark' : ''), 'aria-label': 'Back', html: ICON.back, onClick: close });
    const topWrap = h('div', { class: isPhoto ? 'top' : 'pagebar', style: isPhoto ? '' : 'padding:10px 12px 0' }, backBtn, menuBtn);

    if (isPhoto) {
      const wrap = h('div', { class: 'imgwrap' }, lazyImg(m.display_path || m.thumb_path, '', m.caption || 'Photo'), topWrap);
      if (idx > 0) wrap.appendChild(h('button', { class: 'iconbtn dark nv l', 'aria-label': 'Previous', html: ICON.left, onClick: () => go(-1) }));
      if (idx < ids.length - 1) wrap.appendChild(h('button', { class: 'iconbtn dark nv r', 'aria-label': 'Next', html: ICON.right, onClick: () => go(1) }));
      holder.appendChild(wrap);
    } else {
      holder.appendChild(topWrap);
    }

    const body = h('div', { class: 'body' });
    const age = ageLabel(m, S.settings, S.names);
    body.appendChild(h('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' },
      age ? h('span', { class: 'tag' }, age) : null,
      h('span', { class: 'small muted' }, `${fmtDate(m.taken_on, m.precision)} · ${chapterLabel(m.chapter)}${m.lane === 'together' ? '' : ' · ' + laneName(m.lane)}`)));

    if (isPhoto) {
      if (m.caption) body.appendChild(h('h1', { class: 'vcap' }, m.caption));
    } else {
      const c = NOTE_COLORS[m.note_color] || NOTE_COLORS.gold;
      body.appendChild(h('div', { class: 'notebig', style: `background:${c.bg};border-color:${c.border}` },
        m.note_emoji ? h('div', { class: 'em' }, m.note_emoji) : null,
        h('div', { class: 'nt' }, m.caption || '')));
    }
    if (m.people && m.people.length) body.appendChild(h('div', { class: 'row', style: 'margin-top:10px;gap:6px;flex-wrap:wrap' }, m.people.map((p) => h('span', { class: 'tag o' }, p))));

    // reactions
    body.appendChild(h('div', { class: 'sec', style: 'margin:20px 0 0' }, h('h2', { style: 'font-size:15px' }, 'Reactions')));
    const reactRow = h('div', { class: 'react' });
    const drawReact = (popEmoji) => {
      clear(reactRow);
      const info = reactionInfo(m.id);
      REACTIONS.forEach((e) => {
        const on = info.mine.has(e), n = info.counts[e] || 0;
        reactRow.appendChild(h('button', {
          class: 'rbtn' + (on ? ' on' : '') + (popEmoji === e ? ' pop' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false',
          'aria-label': `${e} ${n} reaction${n === 1 ? '' : 's'}`,
          onClick: async () => {
            setReactionLocal(m.id, e, !on); drawReact(!on ? e : null);
            try { await store.setReaction(m.id, e, !on); }
            catch (err) { setReactionLocal(m.id, e, on); drawReact(null); toast('Could not save reaction'); }
          }
        }, e + (n ? ' ' + n : '')));
      });
    };
    drawReact(null);
    body.appendChild(reactRow);

    // comments
    body.appendChild(h('div', { class: 'sec', style: 'margin:20px 0 0' }, h('h2', { style: 'font-size:15px' }, 'Comments')));
    const list = h('div');
    body.appendChild(list);
    const otherLane = store.me.lane === 'a' ? 'b' : 'a';
    const drawComments = (rows) => {
      clear(list);
      if (!rows.length) list.appendChild(h('div', { class: 'small muted', style: 'margin-top:8px' }, 'No comments yet.'));
      rows.forEach((c) => {
        const mineC = c.user_id === store.me.id;
        const lane = mineC ? store.me.lane : otherLane;
        list.appendChild(h('div', { class: 'cm' },
          h('span', { class: 'avatar l-' + lane }, S.names[lane].charAt(0).toUpperCase()),
          h('div', { class: 'tx' }, h('b', null, mineC ? 'You' : S.names[lane]), ' ', c.body),
          mineC ? h('button', { class: 'x', type: 'button', 'aria-label': 'Delete comment', onClick: async () => { try { await store.deleteComment(c.id); rows = rows.filter((r) => r.id !== c.id); drawComments(rows); } catch (_) { toast('Could not delete'); } } }, 'Delete') : null));
      });
    };
    let rows = [];
    store.listComments(m.id).then((r) => { rows = r; drawComments(rows); }).catch(() => drawComments([]));
    holder.appendChild(body);

    const input = h('input', { class: 'input', type: 'text', maxlength: '500', placeholder: 'Add a comment', 'aria-label': 'Add a comment' });
    const send = h('button', { class: 'iconbtn', style: 'background:#1D2540;color:#fff', 'aria-label': 'Send comment', html: ICON.send });
    const submit = async () => {
      const t = input.value.trim();
      if (!t) return;
      send.disabled = true;
      try { const c = await store.addComment(m.id, t); rows.push(c); input.value = ''; drawComments(rows); }
      catch (_) { toast('Could not send comment'); }
      send.disabled = false;
    };
    send.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    holder.appendChild(h('div', { class: 'cmbar' }, input, send));

    // swipe between memories
    let sx = 0, sy = 0;
    holder.ontouchstart = (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    holder.ontouchend = (e) => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !e.target.closest('input')) go(dx < 0 ? 1 : -1);
    };
  }

  function toggleMenu(m, isMine, anchor) {
    if (menu) { menu.remove(); menu = null; return; }
    menu = h('div', { class: 'menu', role: 'menu' },
      isMine ? [
        h('button', { type: 'button', onClick: () => { menu.remove(); menu = null; m.kind === 'note' ? openNoteForm(m) : openPhotoEdit(m); } }, m.kind === 'note' ? 'Edit note' : 'Edit details'),
        h('button', { type: 'button', class: 'del', onClick: async () => {
          menu.remove(); menu = null;
          const ok = await confirmBox('Delete this memory?', 'This removes it for both of you and cannot be undone.');
          if (!ok) return;
          try {
            await store.deleteMemory(m);
            ids.splice(idx, 1);
            idx = Math.max(0, Math.min(idx, ids.length - 1));
            await reload();
            toast('Deleted');
          } catch (e) { toast('Could not delete: ' + (e.message || 'error')); }
        } }, m.kind === 'note' ? 'Delete note' : 'Delete photo'),
        h('div', { class: 'note' }, 'Only the person who added this sees these options.')
      ] : h('div', { class: 'note', style: 'padding:10px 12px' }, 'Only the person who added this can edit or delete it. You can still react and comment.'));
    (anchor.closest('.viewer') || holder).appendChild(menu);
    menu.style.position = 'fixed';
    menu.style.top = '64px';
    menu.style.right = 'max(8px, calc((100vw - 520px) / 2 + 8px))';
  }

  // re-draw after an edit or a reload
  const off = onChange(() => { if (document.body.contains(el)) render(); else off(); });
  render();
}
