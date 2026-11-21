// Shared app state + small selectors used by every screen.
import { store } from './store.js';
import { chapterLabel } from './dates.js';

export const S = { memories: [], reactions: [], settings: {}, members: [], chapters: [], names: { a: 'You', b: 'Spouse' } };
const listeners = new Set();

const bySort = (x, y) => (x.taken_on < y.taken_on ? -1 : x.taken_on > y.taken_on ? 1 : (x.created_at || '') < (y.created_at || '') ? -1 : 1);

export function setData(d) {
  S.memories = d.memories.slice().sort(bySort);
  S.reactions = d.reactions;
  S.settings = d.settings || {};
  S.members = d.members;
  S.chapters = d.chapters || [];
  const a = d.members.find((m) => m.lane === 'a'), b = d.members.find((m) => m.lane === 'b');
  S.names = { a: (a && a.name) || 'You', b: (b && b.name) || 'Spouse' };
}
export async function reload() {
  setData(await store.loadAll());
  listeners.forEach((fn) => fn());
}
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export const byId = (id) => S.memories.find((m) => m.id === id);
export const mine = (m) => store.me && m.created_by === store.me.id;
export const laneName = (lane) => (lane === 'a' ? S.names.a : lane === 'b' ? S.names.b : 'Together');

export function reactionInfo(id) {
  const counts = {}, mineSet = new Set();
  let total = 0;
  for (const r of S.reactions) {
    if (r.memory_id !== id) continue;
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    total++;
    if (store.me && r.user_id === store.me.id) mineSet.add(r.emoji);
  }
  return { counts, mine: mineSet, total };
}
export function setReactionLocal(id, emoji, on) {
  S.reactions = S.reactions.filter((r) => !(r.memory_id === id && r.emoji === emoji && r.user_id === store.me.id));
  if (on) S.reactions.push({ memory_id: id, emoji, user_id: store.me.id });
}

// Your own chapters
export const ownChapter = (m) => (m && m.custom_chapter && S.chapters.find((c) => c.id === m.custom_chapter)) || null;
export const chapterName = (m) => { const c = ownChapter(m); return c ? c.label : chapterLabel(m.chapter); };
// Own chapters that have memories, each with its memories (oldest first) and where it sits on the timeline.
export function ownChapterGroups() {
  return S.chapters.map((c) => {
    const mems = S.memories.filter((m) => m.custom_chapter === c.id);
    return { c, mems, date: mems.length ? mems[0].taken_on : null, home: mems.length ? mems[0].chapter : null };
  }).filter((g) => g.mems.length);
}

export const photoMems = (arr) => arr.filter((m) => m.kind === 'photo' && m.thumb_path);
