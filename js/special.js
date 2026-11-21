// Birthdays and anniversaries: what's today and what's coming up. Pure date logic (no screen code).
import { todayISO } from './dates.js';

const DAY = 86400000;
const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

export function ordinal(n) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + 'th';
  return n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
}

// Next time a yearly date comes round, on or after today. 29 Feb counts as 28 Feb in other years.
function nextYearly(iso, today) {
  const [y0, m, d] = iso.split('-').map(Number);
  const ty = Number(today.slice(0, 4));
  for (const y of [ty, ty + 1]) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const day = m === 2 && d === 29 && !leap ? 28 : d;
    const occ = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (occ >= today) return { occ, years: y - y0 };
  }
  return null;
}

// settings: wedding_date, baby_date, birth_a, birth_b, baby_name. names: { a, b }. myLane: 'a' | 'b'.
// Returns events sorted by how soon they are: { id, emoji, days, occ, years, title, today, line }.
export function specialDays(settings, names, myLane, today = todayISO()) {
  const s = settings || {};
  const baby = (s.baby_name || '').trim() || 'Baby';
  const out = [];
  const add = (id, iso, make) => {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const n = nextYearly(iso, today);
    if (!n || n.years < 1) return; // not born / not married yet, or it's the very first day
    out.push({ id, occ: n.occ, years: n.years, days: Math.round((utc(n.occ) - utc(today)) / DAY), ...make(n.years) });
  };
  const person = (lane) => {
    const mine = lane === myLane, nm = names[lane];
    return (years) => ({
      emoji: '🎂',
      title: mine ? 'Your birthday' : `${nm}'s birthday`,
      today: mine ? `Happy birthday, ${nm}!` : `It's ${nm}'s birthday today!`,
      line: mine ? `You turn ${years}` : `${nm} turns ${years}`
    });
  };
  add('birth_a', s.birth_a, person('a'));
  add('birth_b', s.birth_b, person('b'));
  add('baby', s.baby_date, (years) => ({
    emoji: '🎈',
    title: `${baby}'s ${ordinal(years)} birthday`,
    today: `Happy ${ordinal(years)} birthday, ${baby}!`,
    line: `${baby} turns ${years}`
  }));
  add('wedding', s.wedding_date, (years) => ({
    emoji: '💍',
    title: `Your ${ordinal(years)} wedding anniversary`,
    today: `Happy ${ordinal(years)} anniversary!`,
    line: `${years} year${years === 1 ? '' : 's'} married`
  }));
  return out.sort((x, y) => x.days - y.days);
}

// "today", "tomorrow", "in 5 days"
export const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);
