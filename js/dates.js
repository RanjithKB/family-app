// Shared constants and date helpers. Dates are plain 'YYYY-MM-DD' strings.

export const CHAPTERS = [
  { id: 'childhood',  label: 'Childhood' },
  { id: 'meetups',    label: 'Meetups' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'wedding',    label: 'Wedding day' },
  { id: 'married',    label: 'Married life' },
  { id: 'baby',       label: 'Baby' }
];
export const chapterLabel = (id) => (CHAPTERS.find((c) => c.id === id) || {}).label || id;

export const WEDDING_EVENTS = [
  { id: 'haldi', label: 'Haldi' },
  { id: 'ceremony', label: 'Ceremony' },
  { id: 'reception', label: 'Reception' },
  { id: 'other', label: 'Other' }
];

export const PRECISIONS = [
  { id: 'day', label: 'Exact day' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'around', label: 'Around' }
];

export const NOTE_COLORS = {
  gold:   { bg: '#FBEFD2', border: '#EBD39B' },
  rose:   { bg: '#F7DDE5', border: '#E3B3C3' },
  teal:   { bg: '#D6EBEF', border: '#A9D0D8' },
  indigo: { bg: '#DCDFF0', border: '#B5BBDD' },
  green:  { bg: '#DDEBDA', border: '#B6D2B0' }
};

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseISO(s) {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function toISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const todayISO = () => toISO(new Date());

// Keep stored dates consistent with their precision.
export function normalizeDate(iso, precision) {
  const [y, m] = iso.split('-');
  if (precision === 'month') return `${y}-${m}-01`;
  if (precision === 'year' || precision === 'around') return `${y}-01-01`;
  return iso;
}

export function fmtDate(iso, precision = 'day') {
  if (!iso) return '';
  const d = parseISO(iso);
  if (precision === 'year') return String(d.getFullYear());
  if (precision === 'around') return `around ${d.getFullYear()}`;
  if (precision === 'month') return `${MON[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthsBetween(fromISO, toISOstr) {
  const a = parseISO(fromISO), b = parseISO(toISOstr);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return m;
}

// "2 years, 3 months"
export function sinceLabel(fromISO, toISOstr = todayISO()) {
  if (!fromISO) return '';
  const total = monthsBetween(fromISO, toISOstr);
  if (total < 0) return 'not yet';
  const y = Math.floor(total / 12), m = total % 12;
  const parts = [];
  if (y) parts.push(`${y} year${y === 1 ? '' : 's'}`);
  if (m || !y) parts.push(`${m} month${m === 1 ? '' : 's'}`);
  return parts.join(', ');
}

// Age shown in the photo view, e.g. "Spouse · age 6" or "Baby · 8 months".
export function ageLabel(mem, settings, names) {
  const when = mem.taken_on;
  const babyChapter = mem.chapter === 'baby';
  let birth = null, who = '';
  if (babyChapter && settings.baby_date) { birth = settings.baby_date; who = 'Baby'; }
  else if (mem.lane === 'a' && settings.birth_a) { birth = settings.birth_a; who = names.a; }
  else if (mem.lane === 'b' && settings.birth_b) { birth = settings.birth_b; who = names.b; }
  if (!birth || birth > when) return '';
  const months = monthsBetween(birth, when);
  if (months < 24) return `${who} · ${months} month${months === 1 ? '' : 's'}`;
  return `${who} · age ${Math.floor(months / 12)}`;
}

// Pick a sensible chapter when the person has not chosen one.
export function suggestChapter(lane, iso, settings) {
  const wed = settings.wedding_date;
  if ((lane === 'a' || lane === 'b') && !(wed && iso >= wed)) return 'childhood';
  if (settings.baby_date && iso >= settings.baby_date) return 'baby';
  if (settings.wedding_date && iso < settings.wedding_date) return 'meetups';
  if (settings.wedding_date && iso === settings.wedding_date) return 'wedding';
  return 'married';
}
