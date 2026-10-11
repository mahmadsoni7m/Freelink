# Manual test checklist

Tick each item after trying it on a real phone browser (Chrome on Android) and once on a desktop browser.

## Create a link
- [ ] Valid https URL returns an `https://is.gd/...` link.
- [ ] Valid http URL works.
- [ ] URL with query parameters and a `#fragment` opens the same destination.
- [ ] Empty input shows a validation message.
- [ ] `javascript:alert(1)`, `data:text/html,x`, `file:///x` are rejected.
- [ ] A custom alias (for example `freelink_test1`) works, or shows "already taken".
- [ ] Alias with `-` or fewer than 5 characters shows a message.
- [ ] Button is disabled and a spinner shows while the request runs; double tap sends only one request.
- [ ] Airplane mode: a clear network error and a "Try again" button appear, and no link is shown.

## Result and history
- [ ] Copy works; if clipboard is blocked a failure toast appears.
- [ ] Open opens the short link in a new tab.
- [ ] Share opens the system share sheet (only visible if the browser supports it).
- [ ] The link appears in history after a reload.
- [ ] Search, sort, label save, delete one entry, clear all (with confirmation) work.
- [ ] In DevTools set `localStorage['freelink.history.v1']` to `{bad` and reload: page works, history is empty.

## Language and layout
- [ ] Tajik is the default on first visit; Russian and English switch instantly, including errors and history.
- [ ] The language choice survives a reload.
- [ ] No horizontal scrolling at 320, 360, 390, 430, 768, 1024 and 1440 px.
- [ ] Menu button works on narrow screens; keyboard Tab shows a visible focus ring.
- [ ] Open the site at `https://USERNAME.github.io/REPO/` and check that styles, scripts and icon load (no 404 in DevTools).

## Known untested at build time
The build environment had no network access and no browser, so the real is.gd/v.gd request, CORS behaviour and the layout were not tested there.
