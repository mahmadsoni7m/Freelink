// URL and alias validation. Pure functions, no DOM access.
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
const BLOCKED_SCHEMES = /^(javascript|data|file|vbscript|blob|about|ftp|mailto|tel):/i;
export const ALIAS_PATTERN = /^[A-Za-z0-9_]{5,30}$/;
export const MAX_URL_LENGTH = 5000;

/** Returns { ok: true, url } or { ok: false, code } where code is an i18n key suffix. */
export function normalizeUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, code: 'empty' };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, code: 'tooLong' };
  if (/\s/.test(raw)) return { ok: false, code: 'invalid' };
  if (BLOCKED_SCHEMES.test(raw)) return { ok: false, code: 'protocol' };

  let candidate = raw;
  const hasScheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw);
  if (!hasScheme) {
    // Any other "scheme:" prefix (not a host:port) is unsafe to guess.
    if (/^[A-Za-z][A-Za-z0-9+.-]*:(?!\d+(\/|$))/.test(raw)) return { ok: false, code: 'protocol' };
    candidate = 'https://' + raw;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, code: 'invalid' };
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return { ok: false, code: 'protocol' };
  if (!isPlausibleHost(parsed.hostname)) return { ok: false, code: 'invalid' };
  return { ok: true, url: parsed.href };
}

function isPlausibleHost(host) {
  if (!host || host === 'localhost') return false;
  if (/^\[.*\]$/.test(host)) return true; // IPv6 literal
  return host.includes('.') && !host.startsWith('.') && !host.endsWith('..');
}

/** Alias is optional. Returns { ok: true, alias } (alias may be '') or { ok: false, code }. */
export function validateAlias(input) {
  const alias = String(input ?? '').trim();
  if (!alias) return { ok: true, alias: '' };
  if (!ALIAS_PATTERN.test(alias)) return { ok: false, code: 'aliasInvalid' };
  return { ok: true, alias };
}

/** Checks that a provider returned a real https link on an expected host. */
export function isValidShortUrl(value, allowedHosts) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && allowedHosts.includes(u.hostname) && u.pathname.length > 1;
  } catch {
    return false;
  }
}
