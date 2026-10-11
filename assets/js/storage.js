// Local history in localStorage. Browser-specific, never synced anywhere.
const KEY = 'freelink.history.v1';
const PREF_KEY = 'freelink.prefs.v1';
const MAX_ITEMS = 200;

function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}

function isValidEntry(e) {
  return e && typeof e === 'object' && typeof e.id === 'string' &&
    typeof e.originalUrl === 'string' && typeof e.shortUrl === 'string' &&
    typeof e.createdAt === 'number' && Number.isFinite(e.createdAt);
}

/** Loads history, silently dropping corrupted entries. */
export function loadHistory() {
  const raw = read(KEY);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(isValidEntry).map((e) => ({
      id: e.id,
      originalUrl: e.originalUrl,
      shortUrl: e.shortUrl,
      createdAt: e.createdAt,
      alias: typeof e.alias === 'string' ? e.alias : '',
      provider: typeof e.provider === 'string' ? e.provider : '',
      label: typeof e.label === 'string' ? e.label.slice(0, 60) : ''
    }));
  } catch {
    return [];
  }
}

export function saveHistory(items) {
  return write(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
}

export function addEntry(entry) {
  const items = loadHistory();
  const full = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(), alias: '', label: '', ...entry
  };
  items.unshift(full);
  return { entry: full, saved: saveHistory(items) };
}

export function updateLabel(id, label) {
  const items = loadHistory().map((e) => (e.id === id ? { ...e, label: label.trim().slice(0, 60) } : e));
  return saveHistory(items);
}

export function removeEntry(id) {
  return saveHistory(loadHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  try { window.localStorage.removeItem(KEY); return true; } catch { return false; }
}

export function loadPrefs() {
  try {
    const p = JSON.parse(read(PREF_KEY) || '{}');
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

export function savePrefs(patch) {
  return write(PREF_KEY, JSON.stringify({ ...loadPrefs(), ...patch }));
}
