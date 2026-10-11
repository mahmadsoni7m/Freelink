# FreeLink

FreeLink is a small web app that shortens long links. It is plain HTML, CSS and JavaScript (no build step, no server, no paid service). The interface is in **Tajik (default)**, Russian and English.

## Quick start (Тоҷикӣ)

1. Дар GitHub репозитория созед (масалан, `FreeLink`).
2. Файлҳои дохили ZIP-ро бор кунед (**Add file → Upload files**), бо ҳамон сохтори ҷузвдонҳо. Агар браузер ҷузвдонро қабул накунад, ба қисмати «Upload from a phone» поён нигаред.
3. **Settings → Pages → Source: Deploy from a branch → Branch: main, folder: / (root) → Save.**
4. Баъд аз 1–2 дақиқа сайт дар `https://НОМИ-ШУМО.github.io/FreeLink/` кушода мешавад.
5. Барои нав кардан: файли навро дубора бор кунед (Commit). Сайт худаш нав мешавад.

## What it does

- Shortens an `http`/`https` link through the free **is.gd** service (or **v.gd**, which uses the same API).
- Optional custom alias (5–30 characters: Latin letters, digits, `_`).
- Copy, open and share (when the browser supports sharing) the result.
- Local history with search, sort, labels, delete and "clear all".
- Dark, responsive interface for phones, tablets and desktops; keyboard and screen-reader friendly; reduced-motion support.

## Project structure

```
index.html              page markup
assets/css/style.css    design tokens and layout
assets/js/app.js        UI logic
assets/js/api.js        shortening provider (replaceable)
assets/js/validation.js URL and alias validation
assets/js/storage.js    localStorage history and preferences
assets/js/i18n.js       tg / ru / en translations
assets/icons/favicon.svg
tests/                  automated tests and manual checklist
.github/workflows/pages.yml  optional GitHub Actions deployment
```

All paths are relative, so the site works at `https://USER.github.io/REPO/` (a repository subpath).

## How shortening works

A static site has no database, so FreeLink asks an existing public service to create the short link. The browser sends the long link to `https://is.gd/create.php` with `format=json` (and `shorturl=ALIAS` if you typed one). The service replies with `{"shorturl": "https://is.gd/..."}` or `{"errorcode": N, "errormessage": "..."}`. FreeLink checks that the reply is a real `https` link on the expected host before it shows it. If anything fails, an error is shown and **no link is displayed or saved**.

The API reference does not state whether browser (CORS) requests are allowed. FreeLink therefore tries a normal `fetch` first and, if the browser blocks it, falls back to the documented `callback` parameter (a script request). This is why the page's Content-Security-Policy allows scripts from `is.gd` and `v.gd`.

### Provider

- Service: **is.gd** (default) and **v.gd**. No account and no API key.
- Documentation: <https://is.gd/apishorteningreference.php>
- Usage limits: <https://is.gd/usagelimits.php>
- Terms: <https://is.gd/terms.php>

### Limitations

- The service has per-IP rate limits (error code 3: wait about a minute). It is meant for low-volume use.
- Short links are permanent and cannot be deleted through the service.
- Custom aliases may already be taken; they are case sensitive and cannot contain `-`.
- No guarantee the service stays free or available forever. Nothing in FreeLink is paid.
- Real network behaviour was **not tested** when this project was generated (the build environment had no internet or browser). Please run `tests/manual-test-checklist.md` after deploying.

### Replace the provider

Edit `assets/js/api.js`: add an entry to `PROVIDERS`, adapt `buildQuery`, `validateProviderResponse` and the request code, and update `connect-src` / `script-src` in the Content-Security-Policy tag in `index.html`. Never put private API keys in front-end code: anyone can read them.

## Local history and privacy

- History and your language/provider choice are stored in your browser's `localStorage`. They are not synced between devices and disappear if you clear site data.
- The original link is sent to is.gd/v.gd, which can see and keep it. Do not shorten private or confidential links.
- FreeLink has no analytics, ads or trackers.

## Publish from an Android phone

Use Chrome on Android; switch on "Desktop site" if GitHub's mobile layout hides options.

1. Sign in at <https://github.com> and tap **+ → New repository**. Name it `FreeLink`, choose **Public**, tap **Create repository**.
2. Extract `FreeLink.zip` with the Files app so you have the folder contents.
3. Upload from a phone:
   - **Option A (files):** **Add file → Upload files**, select the files. Mobile browsers usually cannot select folders, so for files inside folders use **Add file → Create new file**, type the full path in the name box (for example `assets/js/app.js`), paste the content, then **Commit changes**.
   - **Option B (Termux):** `pkg install git unzip`, unzip the project, then `git init`, `git add .`, `git commit -m "FreeLink"`, `git remote add origin https://github.com/USER/FreeLink.git`, `git push -u origin main` (log in with a GitHub personal access token).
4. Open **Settings → Pages**. Under **Build and deployment → Source** choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
5. Wait one to two minutes and open `https://USER.github.io/FreeLink/`.
6. To update later: open the file on GitHub, tap the pencil icon, edit, **Commit changes**; the site refreshes by itself.

Optional: if you choose **Source: GitHub Actions** instead, run the "Deploy FreeLink to GitHub Pages" workflow from the **Actions** tab. It runs the tests first.

Official GitHub Pages documentation: <https://docs.github.com/en/pages>

## Troubleshooting

- **Blank page or no styles:** a file was uploaded to the wrong folder. Check that `assets/css/style.css` and `assets/js/app.js` exist with exactly those paths.
- **404 right after enabling Pages:** wait a few minutes and reload.
- **"Could not reach the service":** check the internet; the service may be blocked on your network. Try the other service in the dropdown.
- **"Too many requests":** wait one minute.
- **Copy does not work:** the browser blocked the clipboard; select the link in the box and copy manually.
- **Old version after an update:** hard-refresh or clear the site cache.

## Tests

`node tests/run-tests.mjs` runs the automated checks for validation, provider-response handling, storage and translations. See `tests/` for details and the manual checklist.

## License

MIT, see `LICENSE`.
