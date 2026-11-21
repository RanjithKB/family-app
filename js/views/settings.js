// Settings page: name, dates, motion, export, sign out.
import { h, page, sheet, confirmBox, toast, ICON, getMotion, setMotion, clear, refreshApp, appVersion } from '../ui.js';
import { S, reload, laneName } from '../state.js';
import { store } from '../store.js';
import { openChapterPicker } from './add.js';
import { CONFIG } from '../config.js';

export function openSettings() {
  let close;
  const lane = store.me ? store.me.lane : 'a';
  const name = h('input', { class: 'input', value: store.me ? store.me.name : S.names.a, maxlength: 30 });
  const dateField = (label, key) => {
    const i = h('input', { class: 'input', type: 'date', value: S.settings[key] || '' });
    return { key, i, el: h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), i) };
  };
  const fields = [
    dateField('Wedding date', 'wedding_date'),
    dateField('Baby date of birth', 'baby_date'),
    dateField(`${S.names.a}'s birthday`, 'birth_a'),
    dateField(`${S.names.b}'s birthday`, 'birth_b')
  ];
  const motion = getMotion();
  const seg = h('div', { class: 'chips' }, [['smooth', 'Smooth'], ['light', 'Light'], ['off', 'Off']].map(([id, l]) =>
    h('button', { class: 'chip' + (id === motion ? ' on' : ''), type: 'button', onClick: (e) => {
      setMotion(id);
      [...seg.children].forEach((c) => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    } }, l)));

  const save = async (btn) => {
    btn.disabled = true;
    try {
      const nm = name.value.trim();
      if (nm && store.me && nm !== store.me.name) await store.renameMe(nm);
      const obj = {};
      fields.forEach((f) => { obj[f.key] = f.i.value; });
      await store.saveSettings(obj);
      await reload();
      toast('Saved');
      close();
    } catch (e) { toast('Could not save. Check your connection.'); btn.disabled = false; }
  };

  const exportJson = () => {
    const data = JSON.stringify({ exported: new Date().toISOString(), settings: S.settings, members: S.members, chapters: S.chapters, memories: S.memories, reactions: S.reactions }, null, 2);
    const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: 'our-memories.json' });
    document.body.appendChild(a); a.click(); a.remove();
  };

  // Your own chapters: rename or delete the ones you made.
  const chBox = h('div');
  const drawChapters = () => {
    clear(chBox);
    if (!S.chapters.length) { chBox.appendChild(h('div', { class: 'small muted' }, 'None yet. Add one with "+ New chapter" when you add photos.')); return; }
    S.chapters.forEach((c) => {
      const count = S.memories.filter((m) => m.custom_chapter === c.id).length;
      const mineC = store.me && c.created_by === store.me.id;
      chBox.appendChild(h('div', { class: 'chrow' },
        h('div', { class: 'tx' }, h('b', null, c.label), h('div', { class: 'small muted' }, `${laneName(c.lane)} · ${count} memor${count === 1 ? 'y' : 'ies'}`)),
        h('div', { class: 'acts' },
          h('button', { class: 'btn ghost sm', type: 'button', onClick: () => openChapterPicker(c, drawChapters) }, 'Choose memories'),
          mineC ? h('button', { class: 'btn ghost sm', type: 'button', onClick: () => renameChapter(c) }, 'Rename') : null,
          mineC ? h('button', { class: 'btn ghost sm del', type: 'button', onClick: () => deleteChapter(c, count) }, 'Delete') : null)));
    });
  };
  const renameChapter = (c) => {
    let closeS;
    const inp = h('input', { class: 'input', type: 'text', maxlength: '40', value: c.label, 'aria-label': 'Chapter name' });
    const ok = h('button', { class: 'btn gold block', type: 'button', style: 'margin-top:18px' }, 'Save name');
    ok.addEventListener('click', async () => {
      const label = inp.value.trim().replace(/\s+/g, ' ');
      if (!label) { toast('Give the chapter a name'); return; }
      ok.disabled = true;
      try { await store.renameChapter(c.id, label); await reload(); drawChapters(); closeS(); toast('Renamed'); }
      catch (e) { ok.disabled = false; toast('Could not rename: ' + (e.message || 'error'), 5000); }
    });
    closeS = sheet('Rename chapter', h('div', null, inp, ok));
  };
  const deleteChapter = async (c, count) => {
    const yes = await confirmBox(`Delete "${c.label}"?`, count ? `Its ${count} memor${count === 1 ? 'y' : 'ies'} stay in your story and move back to their usual chapter.` : 'This chapter has no memories.');
    if (!yes) return;
    try { await store.deleteChapter(c.id); await reload(); drawChapters(); toast('Chapter deleted'); }
    catch (e) { toast('Could not delete: ' + (e.message || 'error'), 5000); }
  };
  drawChapters();
  const versionLine = h('span');
  appVersion().then((v) => { versionLine.textContent = v ? `Version ${v}.` : ''; });

  const saveBtn = h('button', { class: 'btn gold block', type: 'button', onClick: (e) => save(e.currentTarget) }, 'Save');
  const holder = h('div', { class: 'inner' },
    h('div', { class: 'pagebar' }, h('button', { class: 'iconbtn', 'aria-label': 'Back', html: ICON.back, onClick: () => close() }), h('h2', null, 'Settings'), h('span', { style: 'width:44px' })),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Your name'), name),
    fields.map((f) => f.el),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Animations'), seg,
      h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Use Light or Off if the app ever feels slow.')),
    h('div', { style: 'margin-top:24px' }, saveBtn),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Your own chapters'), chBox),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Backup'),
      h('button', { class: 'btn ghost block', type: 'button', onClick: exportJson }, 'Export notes and details (JSON)'),
      h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Photos stay in your private storage. This saves captions, dates and notes.')),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'App'),
      h('button', { class: 'btn ghost block', type: 'button', onClick: (e) => { e.currentTarget.disabled = true; e.currentTarget.textContent = 'Refreshing…'; refreshApp(); } }, 'Refresh app'),
      h('div', { class: 'small muted', style: 'margin-top:8px' }, versionLine, ' Use this if something looks out of date. You stay signed in and nothing is deleted.')),
    h('div', { class: 'field small muted' }, 'Tip: in Chrome, menu > Install app, to add this to your home screen.'),
    store.mode === 'live' ? h('div', { style: 'margin-top:18px' }, h('button', { class: 'btn ghost block', type: 'button', onClick: async () => { await store.signOut(); location.reload(); } }, 'Sign out')) : h('div', { class: 'small muted', style: 'margin-top:18px' }, 'Demo mode: sample data, nothing is saved.'));
  close = page(holder).close;
}
