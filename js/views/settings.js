// Settings page: name, dates, motion, export, sign out.
import { h, page, toast, ICON, getMotion, setMotion } from '../ui.js';
import { S, reload } from '../state.js';
import { store } from '../store.js';
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
    const data = JSON.stringify({ exported: new Date().toISOString(), settings: S.settings, members: S.members, memories: S.memories, reactions: S.reactions }, null, 2);
    const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: 'our-memories.json' });
    document.body.appendChild(a); a.click(); a.remove();
  };

  const saveBtn = h('button', { class: 'btn gold block', type: 'button', onClick: (e) => save(e.currentTarget) }, 'Save');
  const holder = h('div', { class: 'inner' },
    h('div', { class: 'pagebar' }, h('button', { class: 'iconbtn', 'aria-label': 'Back', html: ICON.back, onClick: () => close() }), h('h2', null, 'Settings'), h('span', { style: 'width:44px' })),
    h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Your name'), name),
    fields.map((f) => f.el),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Animations'), seg,
      h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Use Light or Off if the app ever feels slow.')),
    h('div', { style: 'margin-top:24px' }, saveBtn),
    h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Backup'),
      h('button', { class: 'btn ghost block', type: 'button', onClick: exportJson }, 'Export notes and details (JSON)'),
      h('div', { class: 'small muted', style: 'margin-top:8px' }, 'Photos stay in your private storage. This saves captions, dates and notes.')),
    h('div', { class: 'field small muted' }, 'Tip: in Chrome, menu > Install app, to add this to your home screen.'),
    store.mode === 'live' ? h('div', { style: 'margin-top:18px' }, h('button', { class: 'btn ghost block', type: 'button', onClick: async () => { await store.signOut(); location.reload(); } }, 'Sign out')) : h('div', { class: 'small muted', style: 'margin-top:18px' }, 'Demo mode: sample data, nothing is saved.'));
  close = page(holder).close;
}
