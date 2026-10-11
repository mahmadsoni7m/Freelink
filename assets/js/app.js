// FreeLink UI controller. Wires the DOM to the validation, provider, storage and i18n modules.
import { normalizeUrl, validateAlias } from './validation.js';
import { shortenUrl, ShortenError, listProviders, setProvider, getProvider, getProviderCapabilities } from './api.js';
import { addEntry, loadHistory, removeEntry, clearHistory, updateLabel, loadPrefs, savePrefs } from './storage.js';
import { LANGUAGES, DEFAULT_LANG, isSupported, setLang, getLang, t, applyTranslations } from './i18n.js';

const $ = (id) => document.getElementById(id);
const el = {
  form: $('shorten-form'), url: $('url-input'), alias: $('alias-input'), provider: $('provider-select'),
  urlError: $('url-error'), aliasError: $('alias-error'), submit: $('submit-btn'), submitLabel: $('submit-label'),
  alert: $('form-alert'), alertText: $('form-alert-text'), retry: $('retry-btn'),
  result: $('result'), resultUrl: $('result-url'), resultOriginal: $('result-original'),
  copy: $('copy-btn'), open: $('open-btn'), share: $('share-btn'),
  lang: $('lang-select'), nav: $('nav'), navToggle: $('nav-toggle'),
  list: $('history-list'), empty: $('history-empty'), toolbar: $('history-toolbar'),
  search: $('search-input'), sort: $('sort-select'), clear: $('clear-btn'),
  dialog: $('confirm-dialog'), confirmOk: $('confirm-ok'), confirmCancel: $('confirm-cancel'), toasts: $('toasts')
};

const state = { busy: false, formErrorKey: null, urlErrorKey: null, aliasErrorKey: null, lastResult: null, query: '', sort: 'newest' };

/* ---------- helpers ---------- */
function safeHref(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '#';
  } catch {
    return '#';
  }
}

function toast(key, isError = false) {
  const node = document.createElement('div');
  node.className = isError ? 'toast toast--error' : 'toast';
  node.textContent = t(key);
  el.toasts.appendChild(node);
  setTimeout(() => node.remove(), isError ? 5000 : 2600);
}

function formatDate(ts) {
  const locale = getLang() === 'tg' ? 'ru' : getLang();
  try { return new Date(ts).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return new Date(ts).toISOString(); }
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* try fallback */ }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'visually-hidden';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

async function copyWithFeedback(text) {
  const ok = await copyText(text);
  toast(ok ? 'toast.copied' : 'err.copyFail', !ok);
  return ok;
}

/* ---------- field and form errors ---------- */
function setFieldError(node, input, key) {
  if (key) {
    node.textContent = t(key);
    node.hidden = false;
    input.setAttribute('aria-invalid', 'true');
  } else {
    node.textContent = '';
    node.hidden = true;
    input.removeAttribute('aria-invalid');
  }
}
function showUrlError(key) { state.urlErrorKey = key; setFieldError(el.urlError, el.url, key); }
function showAliasError(key) { state.aliasErrorKey = key; setFieldError(el.aliasError, el.alias, key); }
function showFormError(key) {
  state.formErrorKey = key;
  el.alertText.textContent = key ? t(key) : '';
  el.alert.hidden = !key;
}
function clearErrors() { showUrlError(null); showAliasError(null); showFormError(null); }

/* ---------- result card ---------- */
function showResult(shortUrl, originalUrl) {
  state.lastResult = { shortUrl, originalUrl };
  el.resultUrl.value = shortUrl;
  el.resultOriginal.textContent = originalUrl;
  el.open.href = safeHref(shortUrl);
  el.result.hidden = false;
  el.result.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ---------- submit workflow ---------- */
function setBusy(busy) {
  state.busy = busy;
  el.submit.disabled = busy;
  el.submit.setAttribute('aria-busy', String(busy));
  el.submit.querySelector('.spinner').hidden = !busy;
  el.submitLabel.textContent = t(busy ? 'form.submitting' : 'form.submit');
  el.submitLabel.dataset.i18n = busy ? 'form.submitting' : 'form.submit';
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.busy) return;
  clearErrors();

  const urlCheck = normalizeUrl(el.url.value);
  if (!urlCheck.ok) { showUrlError(`err.${urlCheck.code}`); el.url.focus(); return; }
  const aliasCheck = validateAlias(el.alias.value);
  if (!aliasCheck.ok) { showAliasError(`err.${aliasCheck.code}`); el.alias.focus(); return; }

  el.result.hidden = true;
  setBusy(true);
  try {
    const { shortUrl, provider } = await shortenUrl(urlCheck.url, { alias: aliasCheck.alias });
    showResult(shortUrl, urlCheck.url);
    const { saved } = addEntry({ originalUrl: urlCheck.url, shortUrl, alias: aliasCheck.alias, provider });
    renderHistory();
    toast('toast.created');
    if (!saved) toast('err.storage', true);
  } catch (err) {
    handleShortenError(err);
  } finally {
    setBusy(false);
  }
}

function handleShortenError(err) {
  const kind = err instanceof ShortenError ? err.kind : 'service';
  if (kind === 'aliasTaken' || kind === 'badAlias') { showAliasError(`err.${kind}`); el.alias.focus(); return; }
  if (kind === 'badUrl') { showUrlError('err.badUrl'); el.url.focus(); return; }
  showFormError(`err.${kind}`);
}

/* ---------- share ---------- */
async function handleShare() {
  if (!state.lastResult) return;
  try {
    await navigator.share({ title: 'FreeLink', text: t('result.shareText'), url: state.lastResult.shortUrl });
  } catch (err) {
    if (err && err.name !== 'AbortError') toast('err.shareFail', true);
  }
}

/* ---------- history ---------- */
function visibleHistory() {
  const q = state.query.trim().toLowerCase();
  const items = loadHistory().filter((e) => !q || [e.originalUrl, e.shortUrl, e.label, e.alias].some((v) => v.toLowerCase().includes(q)));
  items.sort((a, b) => (state.sort === 'oldest' ? a.createdAt - b.createdAt : b.createdAt - a.createdAt));
  return items;
}

function makeButton(textKey, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = t(textKey);
  b.addEventListener('click', onClick);
  return b;
}

function buildHistoryItem(entry) {
  const li = document.createElement('li');
  li.className = 'history__item';

  const short = document.createElement('a');
  short.className = 'history__short';
  short.href = safeHref(entry.shortUrl);
  short.target = '_blank';
  short.rel = 'noopener noreferrer';
  short.textContent = entry.shortUrl;
  short.dir = 'ltr';

  const orig = document.createElement('p');
  orig.className = 'history__orig';
  orig.textContent = entry.originalUrl;
  orig.dir = 'ltr';

  const meta = document.createElement('p');
  meta.className = 'history__meta';
  const parts = [formatDate(entry.createdAt)];
  if (entry.provider) parts.push(`${t('history.via')}: ${entry.provider}`);
  if (entry.alias) parts.push(entry.alias);
  meta.textContent = parts.join(' | ');

  const labelForm = document.createElement('div');
  labelForm.className = 'history__label-form';
  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'text';
  input.maxLength = 60;
  input.value = entry.label;
  input.placeholder = t('history.label');
  input.setAttribute('aria-label', t('history.label'));
  const saveBtn = makeButton('history.saveLabel', 'btn btn--ghost', () => {
    updateLabel(entry.id, input.value);
    toast('toast.labelSaved');
    renderHistory();
  });
  labelForm.append(input, saveBtn);

  const actions = document.createElement('div');
  actions.className = 'history__actions';
  const open = document.createElement('a');
  open.className = 'btn btn--secondary';
  open.href = safeHref(entry.shortUrl);
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  open.textContent = t('history.open');
  actions.append(
    makeButton('history.copy', 'btn btn--secondary', () => copyWithFeedback(entry.shortUrl)),
    open,
    makeButton('history.delete', 'btn btn--danger', () => { removeEntry(entry.id); renderHistory(); toast('toast.deleted'); })
  );

  if (entry.label) {
    const title = document.createElement('p');
    title.className = 'history__label';
    title.textContent = entry.label;
    li.append(title);
  }
  li.append(short, orig, meta, labelForm, actions);
  return li;
}

function renderHistory() {
  const all = loadHistory();
  const items = visibleHistory();
  el.list.replaceChildren(...items.map(buildHistoryItem));
  el.toolbar.hidden = all.length === 0;
  el.clear.hidden = all.length === 0;
  el.empty.hidden = items.length > 0;
  el.empty.textContent = t(all.length === 0 ? 'history.empty' : 'history.noResults');
  el.empty.dataset.i18n = all.length === 0 ? 'history.empty' : 'history.noResults';
}

function openClearDialog() {
  if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
  else if (window.confirm(t('confirm.clearText'))) doClear();
}
function doClear() {
  clearHistory();
  renderHistory();
  toast('toast.cleared');
}

/* ---------- language and providers ---------- */
function populateSelects() {
  el.lang.replaceChildren(...LANGUAGES.map(({ code, label }) => {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = label;
    return o;
  }));
  el.provider.replaceChildren(...listProviders().map(({ id, name }) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    return o;
  }));
}

function refreshDynamicText() {
  applyTranslations();
  el.submitLabel.textContent = t(state.busy ? 'form.submitting' : 'form.submit');
  if (state.urlErrorKey) showUrlError(state.urlErrorKey);
  if (state.aliasErrorKey) showAliasError(state.aliasErrorKey);
  if (state.formErrorKey) showFormError(state.formErrorKey);
  renderHistory();
}

function changeLanguage(code) {
  const active = setLang(code);
  el.lang.value = active;
  savePrefs({ lang: active });
  refreshDynamicText();
}

/* ---------- init ---------- */
function init() {
  populateSelects();
  const prefs = loadPrefs();
  if (isSupported(prefs.provider)) setProvider(prefs.provider);
  el.provider.value = getProvider().id;
  // Provider capabilities decide whether the alias field is usable.
  el.alias.disabled = !getProviderCapabilities().customAlias;

  setLang(isSupported(prefs.lang) ? prefs.lang : DEFAULT_LANG);
  el.lang.value = getLang();
  if (typeof navigator.share !== 'function') el.share.hidden = true;
  else el.share.hidden = false;

  refreshDynamicText();

  el.form.addEventListener('submit', handleSubmit);
  el.retry.addEventListener('click', () => el.form.requestSubmit());
  el.copy.addEventListener('click', () => state.lastResult && copyWithFeedback(state.lastResult.shortUrl));
  el.share.addEventListener('click', handleShare);
  el.lang.addEventListener('change', () => changeLanguage(el.lang.value));
  el.provider.addEventListener('change', () => { setProvider(el.provider.value); savePrefs({ provider: el.provider.value }); });
  el.url.addEventListener('input', () => showUrlError(null));
  el.alias.addEventListener('input', () => showAliasError(null));
  el.search.addEventListener('input', () => { state.query = el.search.value; renderHistory(); });
  el.sort.addEventListener('change', () => { state.sort = el.sort.value; renderHistory(); });
  el.clear.addEventListener('click', openClearDialog);
  el.confirmCancel.addEventListener('click', () => el.dialog.close());
  el.confirmOk.addEventListener('click', () => { el.dialog.close(); doClear(); });
  el.resultUrl.addEventListener('focus', () => el.resultUrl.select());

  el.navToggle.addEventListener('click', () => {
    const open = el.nav.classList.toggle('is-open');
    el.navToggle.setAttribute('aria-expanded', String(open));
  });
  el.nav.addEventListener('click', (e) => {
    if (e.target instanceof HTMLAnchorElement) {
      el.nav.classList.remove('is-open');
      el.navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

init();
