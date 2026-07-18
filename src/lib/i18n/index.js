// Lightweight i18n system for PGP Core.
// English is the initial active language; Bulgarian, German, Spanish are prepared.
// Navigation labels are stored through the translation system.

import en from "@/lib/i18n/locales/en.json";
import bg from "@/lib/i18n/locales/bg.json";
import de from "@/lib/i18n/locales/de.json";
import es from "@/lib/i18n/locales/es.json";

const LOCALES = { en, bg, de, es };

const STORAGE_KEY = "pgp_core_lang";

let currentLang = localStorage.getItem(STORAGE_KEY) || "en";

const listeners = new Set();

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!LOCALES[lang]) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((fn) => fn(lang));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, lang = currentLang) {
  const dict = LOCALES[lang] || LOCALES.en;
  const parts = key.split(".");
  let val = dict;
  for (const p of parts) {
    val = val?.[p];
    if (val === undefined) break;
  }
  if (val === undefined) {
    // Fallback to English
    let fb = LOCALES.en;
    for (const p of parts) {
      fb = fb?.[p];
      if (fb === undefined) break;
    }
    return fb || key;
  }
  return val;
}

export const SUPPORTED_LANGUAGES = [
  { code: "en", labelKey: "lang.english" },
  { code: "bg", labelKey: "lang.bulgarian" },
  { code: "de", labelKey: "lang.german" },
  { code: "es", labelKey: "lang.spanish" },
];