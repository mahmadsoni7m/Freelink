// Dependency-free tests. Run with: node tests/run-tests.mjs  (Node 18+)
import assert from 'node:assert/strict';
import { normalizeUrl, validateAlias, isValidShortUrl } from '../assets/js/validation.js';
import { getDictionaryKeys } from '../assets/js/i18n.js';

// Minimal browser stubs so provider/storage modules can be imported and exercised.
const store = new Map();
globalThis.window = { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } };
globalThis.document = { documentElement: {}, querySelector: () => null, querySelectorAll: () => [] };
const api = await import('../assets/js/api.js');
const storage = await import('../assets/js/storage.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); } catch (e) { console.error(`FAIL ${name}\n     ${e.message}`); process.exitCode = 1; }
}

// --- URL validation ---
test('valid https URL', () => assert.equal(normalizeUrl('https://example.com/a').ok, true));
test('valid http URL', () => assert.equal(normalizeUrl('http://example.com').ok, true));
test('empty input', () => assert.deepEqual(normalizeUrl('   '), { ok: false, code: 'empty' }));
test('invalid URL', () => assert.equal(normalizeUrl('not a url').ok, false));
test('javascript: rejected', () => assert.equal(normalizeUrl('javascript:alert(1)').code, 'protocol'));
test('data: rejected', () => assert.equal(normalizeUrl('data:text/html,hi').code, 'protocol'));
test('file: rejected', () => assert.equal(normalizeUrl('file:///etc/passwd').code, 'protocol'));
test('ftp:// rejected', () => assert.equal(normalizeUrl('ftp://example.com/x').code, 'protocol'));
test('mixed-case scheme rejected', () => assert.equal(normalizeUrl('JaVaScRiPt:alert(1)').code, 'protocol'));
test('scheme-less host gets https', () => assert.equal(normalizeUrl('example.com/path').url, 'https://example.com/path'));
test('query and fragment preserved', () => assert.equal(normalizeUrl('https://example.com/a?x=1&y=2#top').url, 'https://example.com/a?x=1&y=2#top'));
test('international characters accepted', () => assert.equal(normalizeUrl('https://пример.рф/страница?q=тест').ok, true));
test('localhost rejected', () => assert.equal(normalizeUrl('http://localhost:3000').ok, false));
test('overlong URL rejected', () => assert.equal(normalizeUrl('https://example.com/' + 'a'.repeat(5000)).code, 'tooLong'));

// --- Alias validation ---
test('empty alias allowed', () => assert.deepEqual(validateAlias(''), { ok: true, alias: '' }));
test('valid alias', () => assert.equal(validateAlias('my_link1').ok, true));
test('alias too short', () => assert.equal(validateAlias('abc').ok, false));
test('alias too long', () => assert.equal(validateAlias('a'.repeat(31)).ok, false));
test('alias with hyphen rejected (is.gd allows only alphanumerics and _)', () => assert.equal(validateAlias('my-link').ok, false));

// --- Provider response validation ---
test('short URL host check', () => {
  assert.equal(isValidShortUrl('https://is.gd/abc123', ['is.gd']), true);
  assert.equal(isValidShortUrl('http://is.gd/abc123', ['is.gd']), false);
  assert.equal(isValidShortUrl('https://evil.example/abc', ['is.gd']), false);
  assert.equal(isValidShortUrl('https://is.gd/', ['is.gd']), false);
});
test('valid provider response', () => assert.equal(api.validateProviderResponse({ shorturl: 'https://is.gd/R709K6' }), 'https://is.gd/R709K6'));
test('malformed provider response', () => {
  for (const bad of [null, 'x', {}, { shorturl: 5 }, { shorturl: 'https://evil.example/x' }]) {
    assert.throws(() => api.validateProviderResponse(bad), (e) => e.kind === 'malformed');
  }
});
test('provider error codes map to kinds', () => {
  const kind = (b) => { try { api.validateProviderResponse(b); } catch (e) { return e.kind; } };
  assert.equal(kind({ errorcode: 1, errormessage: 'x' }), 'badUrl');
  assert.equal(kind({ errorcode: 2, errormessage: 'Short URL already exists' }), 'aliasTaken');
  assert.equal(kind({ errorcode: 3, errormessage: 'x' }), 'rateLimit');
  assert.equal(kind({ errorcode: 4, errormessage: 'x' }), 'service');
});
test('v.gd provider validates its own host', () => {
  api.setProvider('vgd');
  assert.equal(api.validateProviderResponse({ shorturl: 'https://v.gd/abc123' }), 'https://v.gd/abc123');
  assert.throws(() => api.validateProviderResponse({ shorturl: 'https://is.gd/abc123' }));
  api.setProvider('isgd');
});

// --- Storage ---
test('history add, load, label, delete, clear', () => {
  storage.clearHistory();
  const { entry } = storage.addEntry({ originalUrl: 'https://example.com', shortUrl: 'https://is.gd/abc123', provider: 'is.gd' });
  assert.equal(storage.loadHistory().length, 1);
  storage.updateLabel(entry.id, '  Docs  ');
  assert.equal(storage.loadHistory()[0].label, 'Docs');
  storage.removeEntry(entry.id);
  assert.equal(storage.loadHistory().length, 0);
  storage.addEntry({ originalUrl: 'https://example.com', shortUrl: 'https://is.gd/abc123' });
  storage.clearHistory();
  assert.equal(storage.loadHistory().length, 0);
});
test('corrupted storage is handled', () => {
  store.set('freelink.history.v1', '{not json');
  assert.deepEqual(storage.loadHistory(), []);
  store.set('freelink.history.v1', JSON.stringify([{ id: 1 }, null, 'x', { id: 'a', originalUrl: 'u', shortUrl: 's', createdAt: 1 }]));
  assert.equal(storage.loadHistory().length, 1);
  store.set('freelink.history.v1', '{"a":1}');
  assert.deepEqual(storage.loadHistory(), []);
});

// --- i18n ---
test('all languages have identical key sets', () => {
  const keys = getDictionaryKeys();
  const base = [...keys.en].sort();
  for (const lang of ['tg', 'ru']) assert.deepEqual([...keys[lang]].sort(), base, `${lang} differs from en`);
});

// --- shortenUrl with a mocked fetch (no real network) ---
async function atest(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); } catch (e) { console.error(`FAIL ${name}\n     ${e.message}`); process.exitCode = 1; }
}
const jsonRes = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
await atest('shortenUrl success sends encoded url and alias', async () => {
  let called;
  globalThis.fetch = async (u) => { called = new URL(u); return jsonRes({ shorturl: 'https://is.gd/abc123' }); };
  const r = await api.shortenUrl('https://example.com/a?x=1&y=2#f', { alias: 'my_link' });
  assert.equal(r.shortUrl, 'https://is.gd/abc123');
  assert.equal(called.searchParams.get('url'), 'https://example.com/a?x=1&y=2#f');
  assert.equal(called.searchParams.get('shorturl'), 'my_link');
  assert.equal(called.searchParams.get('format'), 'json');
});
await atest('shortenUrl API error is thrown, not faked', async () => {
  globalThis.fetch = async () => jsonRes({ errorcode: 3, errormessage: 'rate' }, 200);
  await assert.rejects(api.shortenUrl('https://example.com'), (e) => e.kind === 'rateLimit');
});
await atest('shortenUrl HTTP 502 without JSON maps to rateLimit', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => { throw new Error('no json'); } });
  await assert.rejects(api.shortenUrl('https://example.com'), (e) => e.kind === 'rateLimit');
});
await atest('shortenUrl malformed success body is rejected', async () => {
  globalThis.fetch = async () => jsonRes({ shorturl: 'javascript:alert(1)' });
  await assert.rejects(api.shortenUrl('https://example.com'), (e) => e.kind === 'malformed');
});

console.log(`\n${passed} tests passed`);
