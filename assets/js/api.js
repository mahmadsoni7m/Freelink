// Shortening provider module. Replace or extend PROVIDERS to change the service.
// Source of truth: https://is.gd/apishorteningreference.php (v.gd uses the same API).
import { isValidShortUrl } from './validation.js';

const PROVIDERS = {
  isgd: { id: 'isgd', name: 'is.gd', host: 'is.gd', endpoint: 'https://is.gd/create.php' },
  vgd: { id: 'vgd', name: 'v.gd', host: 'v.gd', endpoint: 'https://v.gd/create.php' }
};
const TIMEOUT_MS = 15000;
let currentId = 'isgd';

export class ShortenError extends Error {
  /** kind: network | rateLimit | badUrl | badAlias | aliasTaken | service | malformed */
  constructor(kind, detail = '') {
    super(kind);
    this.kind = kind;
    this.detail = detail;
  }
}

export function listProviders() {
  return Object.values(PROVIDERS).map(({ id, name }) => ({ id, name }));
}
export function setProvider(id) {
  if (PROVIDERS[id]) currentId = id;
}
export function getProvider() {
  return PROVIDERS[currentId];
}

export function getProviderCapabilities() {
  return { customAlias: true, aliasMin: 5, aliasMax: 30, requiresKey: false, permanent: true };
}

export function getProviderStatus() {
  // The API has no status endpoint, so this only reports configuration.
  const p = getProvider();
  return { name: p.name, https: p.endpoint.startsWith('https://') };
}

/** Maps documented is.gd error codes to a ShortenError. */
function errorFromBody(body) {
  const code = Number(body.errorcode);
  const msg = String(body.errormessage || '');
  if (code === 1) return new ShortenError('badUrl', msg);
  if (code === 2) return new ShortenError(/already|exist|taken|in use/i.test(msg) ? 'aliasTaken' : 'badAlias', msg);
  if (code === 3) return new ShortenError('rateLimit', msg);
  return new ShortenError('service', msg);
}

/** Returns the short URL string, or throws if the response is not a valid success. */
export function validateProviderResponse(body) {
  if (!body || typeof body !== 'object') throw new ShortenError('malformed');
  if (body.errorcode !== undefined || body.errormessage !== undefined) throw errorFromBody(body);
  if (typeof body.shorturl !== 'string' || !isValidShortUrl(body.shorturl, [getProvider().host])) {
    throw new ShortenError('malformed');
  }
  return body.shorturl;
}

function buildQuery(originalUrl, alias) {
  const q = new URLSearchParams({ format: 'json', url: originalUrl });
  if (alias) q.set('shorturl', alias);
  return q.toString();
}

async function requestViaFetch(endpoint, query, signal) {
  const res = await fetch(`${endpoint}?${query}`, {
    method: 'GET', signal, credentials: 'omit', referrerPolicy: 'no-referrer'
  });
  let body = null;
  try { body = await res.json(); } catch { /* handled below */ }
  if (body) return body;
  if (res.status === 502) return { errorcode: 3, errormessage: 'rate limit' };
  throw new ShortenError(res.ok ? 'malformed' : 'service');
}

// Documented fallback: the API supports a JSON "callback" parameter for cross-domain use.
function requestViaCallback(endpoint, query) {
  return new Promise((resolve, reject) => {
    const name = `__freelink_cb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const script = document.createElement('script');
    let timer = null;
    const cleanup = () => {
      delete window[name];
      script.remove();
      clearTimeout(timer);
    };
    timer = setTimeout(() => { cleanup(); reject(new ShortenError('network')); }, TIMEOUT_MS);
    window[name] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new ShortenError('network')); };
    script.referrerPolicy = 'no-referrer';
    script.src = `${endpoint}?${query}&callback=${name}`;
    document.head.appendChild(script);
  });
}

/** options: { alias?: string }. Resolves to { shortUrl, provider }. */
export async function shortenUrl(originalUrl, options = {}) {
  const provider = getProvider();
  const query = buildQuery(originalUrl, options.alias || '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let body;
  try {
    try {
      body = await requestViaFetch(provider.endpoint, query, controller.signal);
    } catch (err) {
      if (err instanceof ShortenError) throw err;
      if (err && err.name === 'AbortError') throw new ShortenError('network');
      body = await requestViaCallback(provider.endpoint, query); // fetch blocked (e.g. by CORS)
    }
  } finally {
    clearTimeout(timer);
  }
  return { shortUrl: validateProviderResponse(body), provider: provider.name };
}
