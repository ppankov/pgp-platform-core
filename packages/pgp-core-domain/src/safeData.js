// PGP Core — Safe Data Domain (provider-independent)
// Behavioral parity with deployed Base44 function:
//   processBackgroundJobs/entry.ts (hasSecretKey / redactResult / sanitizeErrorText)
// Pure: no Base44, no Deno, no Supabase, no network, no env, no implicit time,
// no side effects, no input mutation. Secret vocabulary is fixed at current
// deployed set — do NOT expand or shrink in this wave.

const SECRET_KEYS = [
  "password", "passwd", "secret", "token", "access_token", "refresh_token",
  "api_key", "apikey", "client_secret", "private_key", "credential",
  "authorization", "cookie", "session",
];

const SECRET_TEXT_KEY = /\b(password|passwd|secret|token|access_token|refresh_token|api_key|apikey|client_secret|private_key|credential|credentialref|authorization|cookie|session)\b\s*[:=]\s*([^\s,;"']+)/gi;
const BEARER_TEXT = /\b(Bearer)\s+([^\s,;"']+)/gi;
const MAX_ERROR_LEN = 500;

export function containsSecretKey(value, depth = 0) {
  if (depth > 12 || value == null || typeof value !== "object") return false;
  for (const k of Object.keys(value)) {
    const lk = String(k).toLowerCase();
    if (SECRET_KEYS.some((s) => lk.includes(s))) return true;
    if (containsSecretKey(value[k], depth + 1)) return true;
  }
  return false;
}

export function redactSecretKeys(value, depth = 0) {
  if (depth > 12 || value == null || typeof value !== "object") return value;
  const out = Array.isArray(value) ? [] : {};
  for (const k of Object.keys(value)) {
    const lk = String(k).toLowerCase();
    if (SECRET_KEYS.some((s) => lk.includes(s))) out[k] = "[redacted]";
    else out[k] = redactSecretKeys(value[k], depth + 1);
  }
  return out;
}

export function sanitizeErrorText(message) {
  let s = typeof message === "string" ? message : String(message || "");
  s = s.replace(SECRET_TEXT_KEY, "$1=[redacted]");
  s = s.replace(BEARER_TEXT, "$1 [redacted]");
  return s.length > MAX_ERROR_LEN ? s.slice(0, MAX_ERROR_LEN) : s;
}