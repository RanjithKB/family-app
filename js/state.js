// Shared app state + small selectors used by every screen.
import { store } from './store.js';

export const S = { memories: [], reactions: [], settings: {}, members: [], names: { a: 'You', b: 'Spouse' } };
const listeners = new Set();

const bySort = (x, y) => (x.taken_on < y.taken_on ? -1 : x.taken_on > y.taken_on ? 1 : (x.created_at || '') < (y.created_at || '') ? -1 : 1);

export function setData(d) {
  S.memories = d.memories.slice().sort(bySort);
  S.reactions = d.reactions;
  S.settings = d.settings || {};
  S.members = d.members;
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

export const photoMems = (arr) => arr.filter((m) => m.kind === 'photo' && m.thumb_path);
