// Data layer. One interface, two implementations:
//   live  -> Supabase (sign-in, database, private photo storage)
//   demo  -> sample data in memory so you can try the app with no setup
import { CONFIG } from './config.js';

const EXT = (blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg');

// ---------------------------------------------------------------- live (Supabase)
function createLive() {
  let sb = null, user = null, me = null;
  const urlCache = new Map();   // path -> { url, exp }
  let queue = [], timer = null;
  const SIGN_TTL = 60 * 60 * 24 * 7; // 7 days

  try {
    const saved = JSON.parse(localStorage.getItem('sigurls') || '{}');
    const now = Date.now();
    for (const [p, v] of Object.entries(saved)) if (v.exp - now > 86400000) urlCache.set(p, v);
  } catch (_) { /* ignore */ }
  let persistTimer = null;
  const persist = () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try { localStorage.setItem('sigurls', JSON.stringify(Object.fromEntries(urlCache))); } catch (_) { /* full */ }
    }, 2500);
  };

  async function fetchAll(table, order) {
    let out = [], from = 0;
    const size = 1000;
    for (;;) {
      const { data, error } = await sb.from(table).select('*').order(order, { ascending: true }).range(from, from + size - 1);
      if (error) throw error;
      out = out.concat(data);
      if (data.length < size) break;
      from += size;
    }
    return out;
  }

  async function flushUrls() {
    const batch = queue; queue = []; timer = null;
    const paths = [...new Set(batch.map((b) => b.path))];
    let map = {};
    try {
      const { data, error } = await sb.storage.from(CONFIG.BUCKET).createSignedUrls(paths, SIGN_TTL);
      if (error) throw error;
      const exp = Date.now() + SIGN_TTL * 1000;
      for (const r of data) if (r.signedUrl) { map[r.path] = r.signedUrl; urlCache.set(r.path, { url: r.signedUrl, exp }); }
      persist();
    } catch (_) { /* leave blank, caller handles null */ }
    for (const b of batch) b.resolve(map[b.path] || null);
  }

  return {
    mode: 'live',
    get me() { return me; },

    async init() {
      const mod = await import('https://esm.sh/@supabase/supabase-js@2');
      sb = mod.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
      });
      const { data } = await sb.auth.getSession();
      if (!data.session) return { state: 'signed-out' };
      user = data.session.user;
      const { data: members, error } = await sb.from('members').select('*');
      const mine = !error && members && members.find((m) => m.email.toLowerCase() === (user.email || '').toLowerCase());
      if (!mine) return { state: 'not-member', email: user.email };
      me = { id: user.id, email: user.email, name: mine.name, lane: mine.lane };
      return { state: 'ready' };
    },

    async signIn() {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname }
      });
      if (error) throw error;
    },
    async signOut() { localStorage.removeItem('sigurls'); await sb.auth.signOut(); },

    async loadAll() {
      const [memories, reactions, settingsRows, members, chapters] = await Promise.all([
        fetchAll('memories', 'taken_on'),
        fetchAll('reactions', 'memory_id'),
        sb.from('settings').select('*').then((r) => { if (r.error) throw r.error; return r.data; }),
        sb.from('members').select('*').then((r) => { if (r.error) throw r.error; return r.data; }),
        // Older databases may not have the chapters table yet (re-run schema.sql to add it).
        sb.from('chapters').select('*').order('created_at').then((r) => { if (r.error) { console.warn('Own chapters unavailable:', r.error.message); return []; } return r.data; })
      ]);
      const settings = {};
      for (const r of settingsRows) settings[r.key] = r.value;
      return { memories, reactions, settings, members, chapters };
    },

    imageUrl(path) {
      if (!path) return Promise.resolve(null);
      const hit = urlCache.get(path);
      if (hit && hit.exp - Date.now() > 86400000) return Promise.resolve(hit.url);
      return new Promise((resolve) => {
        queue.push({ path, resolve });
        if (!timer) timer = setTimeout(flushUrls, 40);
      });
    },

    async addMemory(rec, blobs) {
      const id = crypto.randomUUID();
      const base = `${user.id}/${id}`;
      const uploaded = [];
      let thumb_path = null, display_path = null;
      try {
        if (blobs) {
          thumb_path = `${base}/t.${EXT(blobs.thumb)}`;
          display_path = `${base}/d.${EXT(blobs.display)}`;
          for (const [p, b] of [[thumb_path, blobs.thumb], [display_path, blobs.display]]) {
            const { error } = await sb.storage.from(CONFIG.BUCKET).upload(p, b, { contentType: b.type, cacheControl: '31536000', upsert: false });
            if (error) throw error;
            uploaded.push(p);
          }
        }
        const row = { ...rec, id, thumb_path, display_path };
        const { data, error } = await sb.from('memories').insert(row).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        if (uploaded.length) sb.storage.from(CONFIG.BUCKET).remove(uploaded);
        throw e;
      }
    },

    async updateMemory(id, patch) {
      const { data, error } = await sb.from('memories').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async deleteMemory(mem) {
      const { error } = await sb.from('memories').delete().eq('id', mem.id);
      if (error) throw error;
      const paths = [mem.thumb_path, mem.display_path].filter(Boolean);
      if (paths.length) sb.storage.from(CONFIG.BUCKET).remove(paths);
    },

    async setReaction(memoryId, emoji, on) {
      if (on) {
        const { error } = await sb.from('reactions').insert({ memory_id: memoryId, emoji });
        if (error) throw error;
      } else {
        const { error } = await sb.from('reactions').delete().eq('memory_id', memoryId).eq('emoji', emoji).eq('user_id', user.id);
        if (error) throw error;
      }
    },

    async listComments(memoryId) {
      const { data, error } = await sb.from('comments').select('*').eq('memory_id', memoryId).order('created_at');
      if (error) throw error;
      return data;
    },
    async addComment(memoryId, body) {
      const { data, error } = await sb.from('comments').insert({ memory_id: memoryId, body }).select().single();
      if (error) throw error;
      return data;
    },
    async deleteComment(id) {
      const { error } = await sb.from('comments').delete().eq('id', id);
      if (error) throw error;
    },

    // Put memories into one of your chapters (chapterId) or take them out (null).
    // Row-level security only lets you change memories you added.
    async setChapter(ids, chapterId) {
      if (!ids.length) return 0;
      const { data, error } = await sb.from('memories').update({ custom_chapter: chapterId }).in('id', ids).select('id');
      if (error) throw error;
      return data.length;
    },

    async addChapter({ label, lane }) {
      const { data, error } = await sb.from('chapters').insert({ label, lane }).select().single();
      if (error) throw error;
      return data;
    },
    async renameChapter(id, label) {
      const { error } = await sb.from('chapters').update({ label }).eq('id', id);
      if (error) throw error;
    },
    async deleteChapter(id) {
      const { error } = await sb.from('chapters').delete().eq('id', id);
      if (error) throw error;
    },

    async saveSettings(obj) {
      const rows = Object.entries(obj).map(([key, value]) => ({ key, value: value || null }));
      const { error } = await sb.from('settings').upsert(rows);
      if (error) throw error;
    },
    async renameMe(name) {
      const { error } = await sb.from('members').update({ name }).eq('email', me.email);
      if (error) throw error;
      me.name = name;
    }
  };
}

// ---------------------------------------------------------------- demo (sample data)
function tile(bg, fg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600"><rect width="480" height="600" fill="${bg}"/><circle cx="170" cy="250" r="70" fill="${fg}" opacity=".35"/><circle cx="310" cy="290" r="55" fill="${fg}" opacity=".25"/><rect x="0" y="430" width="480" height="170" fill="${fg}" opacity=".18"/></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function createDemo() {
  const me = { id: 'demo-a', email: 'you@example.com', name: 'You', lane: 'a' };
  const members = [
    { email: me.email, name: 'You', lane: 'a' },
    { email: 'spouse@example.com', name: 'Spouse', lane: 'b' }
  ];
  const settings = { wedding_date: '2023-02-12', baby_date: '2025-09-10', birth_a: '1992-05-04', birth_b: '1993-08-19' };
  const C = { teal: ['#CFE5EA', '#1F7A8C'], rose: ['#F1D3DC', '#B8456A'], gold: ['#F6E2BC', '#8A5A0E'], indigo: ['#D5D9EA', '#3B4A8A'], green: ['#D6E6D3', '#3F7A3A'] };
  let n = 0;
  const ph = (c) => { const t = tile(...C[c]); return { thumb_path: t, display_path: t, width: 480, height: 600 }; };
  const mk = (kind, lane, chapter, taken_on, o = {}) => ({
    id: 'd' + (++n), kind, lane, chapter, event: null, caption: null, note_emoji: null, note_color: null,
    precision: 'day', people: [], created_by: 'demo-a', created_at: new Date(Date.now() - n * 3600000).toISOString(), ...o, taken_on
  });
  const P = (lane, chapter, date, caption, color, o = {}) => mk('photo', lane, chapter, date, { caption, ...ph(color), ...o });
  let memories = [
    P('a', 'childhood', '1994-01-01', 'With Amma and Appa', 'teal', { precision: 'around', people: ['Amma', 'Appa'] }),
    P('a', 'childhood', '1998-01-01', 'With siblings', 'green', { precision: 'year' }),
    P('a', 'childhood', '2011-06-01', 'College days', 'indigo', { precision: 'month' }),
    P('b', 'childhood', '1995-01-01', 'With her parents', 'rose', { precision: 'around' }),
    P('b', 'childhood', '2001-01-01', 'School day', 'gold', { precision: 'year' }),
    P('b', 'childhood', '2014-03-01', 'First job', 'teal', { precision: 'month' }),
    P('together', 'meetups', '2022-05-14', 'Coffee, the first of many', 'gold', { created_by: 'demo-b' }),
    P('together', 'meetups', '2022-06-20', 'Walk by the lake', 'green'),
    P('together', 'meetups', '2022-08-02', 'Movie night', 'indigo'),
    P('together', 'engagement', '2022-11-27', 'Engagement day', 'rose'),
    P('together', 'engagement', '2022-11-27', 'Rings', 'gold'),
    P('together', 'wedding', '2023-02-10', 'Haldi', 'gold', { event: 'haldi' }),
    P('together', 'wedding', '2023-02-10', 'Haldi fun', 'green', { event: 'haldi' }),
    P('together', 'wedding', '2023-02-12', 'The ceremony', 'rose', { event: 'ceremony' }),
    P('together', 'wedding', '2023-02-12', 'Saptapadi', 'gold', { event: 'ceremony' }),
    P('together', 'wedding', '2023-02-12', 'Family photo', 'teal', { event: 'ceremony' }),
    P('together', 'wedding', '2023-02-13', 'Reception', 'indigo', { event: 'reception' }),
    P('together', 'married', '2023-10-24', 'First festival together', 'gold'),
    mk('note', 'together', 'married', '2023-12-02', { caption: 'Still laughing about the burnt dosa from today', note_emoji: '😂', note_color: 'gold', created_by: 'demo-b' }),
    P('together', 'married', '2024-04-06', 'Our first trip', 'teal'),
    mk('note', 'together', 'baby', '2025-09-10', { caption: 'Welcome to the world, little one', note_emoji: '🥹💛', note_color: 'rose' }),
    P('together', 'baby', '2025-09-12', 'Coming home', 'indigo', { created_by: 'demo-b' }),
    P('together', 'baby', '2026-03-15', 'First smile', 'rose'),
    P('together', 'baby', '2026-09-10', 'First birthday', 'gold')
  ];
  let reactions = [
    { memory_id: 'd14', user_id: 'demo-b', emoji: '❤️' }, { memory_id: 'd14', user_id: 'demo-a', emoji: '❤️' },
    { memory_id: 'd19', user_id: 'demo-a', emoji: '😂' }, { memory_id: 'd21', user_id: 'demo-b', emoji: '🥹' }
  ];
  const comments = {};
  let chapters = [];
  return {
    mode: 'demo',
    get me() { return me; },
    async init() { return { state: 'ready' }; },
    async signIn() {}, async signOut() {},
    async loadAll() { return { memories: memories.map((m) => ({ ...m })), reactions: reactions.map((r) => ({ ...r })), settings: { ...settings }, members: members.map((m) => ({ ...m })), chapters: chapters.map((c) => ({ ...c })) }; },
    imageUrl(path) { return Promise.resolve(path || null); },
    async addMemory(rec, blobs) {
      const m = { id: 'd' + (++n), created_at: new Date().toISOString(), created_by: me.id, people: [], event: null, caption: null, note_emoji: null, note_color: null, ...rec };
      if (blobs) { m.thumb_path = URL.createObjectURL(blobs.thumb); m.display_path = URL.createObjectURL(blobs.display); }
      memories.push(m);
      return { ...m };
    },
    async updateMemory(id, patch) { const m = memories.find((x) => x.id === id); Object.assign(m, patch); return { ...m }; },
    async deleteMemory(mem) { memories = memories.filter((x) => x.id !== mem.id); reactions = reactions.filter((r) => r.memory_id !== mem.id); },
    async setReaction(memoryId, emoji, on) {
      reactions = reactions.filter((r) => !(r.memory_id === memoryId && r.emoji === emoji && r.user_id === me.id));
      if (on) reactions.push({ memory_id: memoryId, user_id: me.id, emoji });
    },
    async listComments(id) { return (comments[id] || []).slice(); },
    async addComment(id, body) { const c = { id: 'c' + Math.random(), memory_id: id, user_id: me.id, body, created_at: new Date().toISOString() }; (comments[id] = comments[id] || []).push(c); return c; },
    async deleteComment(id) { for (const k in comments) comments[k] = comments[k].filter((c) => c.id !== id); },
    async setChapter(ids, chapterId) { let k = 0; memories.forEach((m) => { if (ids.includes(m.id)) { m.custom_chapter = chapterId; k++; } }); return k; },
    async addChapter({ label, lane }) { const c = { id: 'c' + (++n), label, lane, created_by: me.id, created_at: new Date().toISOString() }; chapters.push(c); return { ...c }; },
    async renameChapter(id, label) { const c = chapters.find((x) => x.id === id); if (c) c.label = label; },
    async deleteChapter(id) { chapters = chapters.filter((c) => c.id !== id); memories.forEach((m) => { if (m.custom_chapter === id) m.custom_chapter = null; }); },
    async saveSettings(obj) { Object.assign(settings, obj); },
    async renameMe(name) { me.name = name; members.find((m) => m.lane === 'a').name = name; }
  };
}

export const store = CONFIG.DEMO_MODE ? createDemo() : createLive();
