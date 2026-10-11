# Automated tests

Run: `node tests/run-tests.mjs` (Node 18 or newer, no dependencies).

The script covers the pure logic only (it does not open a browser and does not call the real API):

- URL validation: valid https/http, empty, invalid, `javascript:`, `data:`, `file:`, `ftp://`, mixed-case schemes, scheme-less hosts, query strings, fragments, international characters, localhost, overlong URLs.
- Alias validation: empty, valid, too short, too long, forbidden characters.
- Provider response validation: valid response, malformed responses, wrong host, error-code mapping, v.gd host.
- Local history: add, label, delete, clear, corrupted storage data.
- Translations: tg, ru and en have the same set of keys.

Not covered by this script (see `manual-test-checklist.md`): real network calls, layout, clipboard, share sheet, dialog, language switching in the page.
