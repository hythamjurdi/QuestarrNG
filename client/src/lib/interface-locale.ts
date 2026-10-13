import { useSyncExternalStore } from "react";
import { UI_LABELS } from "./ui-labels";

export const INTERFACE_LANGUAGE_OPTIONS = [
  { value: "en", nativeName: "English", englishName: undefined },
  { value: "es", nativeName: "Español", englishName: "Spanish" },
  { value: "zh-Hans", nativeName: "简体中文", englishName: "Simplified Chinese" },
  { value: "hi", nativeName: "हिन्दी", englishName: "Hindi" },
  { value: "de", nativeName: "Deutsch", englishName: "German" },
  { value: "ja", nativeName: "日本語", englishName: "Japanese" },
  { value: "fr", nativeName: "Français", englishName: "French" },
  { value: "pt-BR", nativeName: "Português (Brasil)", englishName: "Brazilian Portuguese" },
  { value: "ar", nativeName: "العربية", englishName: "Arabic" },
  { value: "ko", nativeName: "한국어", englishName: "Korean" },
  { value: "zh-Hant", nativeName: "繁體中文", englishName: "Traditional Chinese" },
  { value: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
  { value: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian" },
] as const;

export type InterfaceLanguage = (typeof INTERFACE_LANGUAGE_OPTIONS)[number]["value"];
const STORAGE_KEY = "questarr.interface-language";
const listeners = new Set<() => void>();

export function getInterfaceCollator(
  language: InterfaceLanguage = "en",
  options?: Intl.CollatorOptions
): Intl.Collator {
  return new Intl.Collator(language, { sensitivity: "base", ...options });
}

function isInterfaceLanguage(value: string | null): value is InterfaceLanguage {
  return INTERFACE_LANGUAGE_OPTIONS.some((option) => option.value === value);
}

export function getBrowserInterfaceLanguage(
  browser: Pick<Navigator, "language" | "languages"> | null = typeof navigator === "undefined"
    ? null
    : navigator
): InterfaceLanguage {
  if (!browser) return "en";
  for (const candidate of browser.languages?.length ? browser.languages : [browser.language]) {
    const normalized = candidate.toLowerCase();
    const base = normalized.split(/[-_]/)[0];
    if (base === "en") return "en";
    if (base === "zh") {
      const subtags = normalized.split(/[-_]/);
      if (subtags.includes("hans")) return "zh-Hans";
      if (subtags.includes("hant")) return "zh-Hant";
      return subtags.some((subtag) => subtag === "tw" || subtag === "hk" || subtag === "mo")
        ? "zh-Hant"
        : "zh-Hans";
    }
    if (base === "pt") return "pt-BR";
    if (
      base === "es" ||
      base === "hi" ||
      base === "de" ||
      base === "ja" ||
      base === "fr" ||
      base === "ar" ||
      base === "ko" ||
      base === "vi" ||
      base === "id"
    )
      return base;
  }
  return "en";
}

function browserLanguage(): InterfaceLanguage {
  return getBrowserInterfaceLanguage();
}

function readLanguage(): InterfaceLanguage {
  try {
    const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    return isInterfaceLanguage(stored) ? stored : browserLanguage();
  } catch {
    return browserLanguage();
  }
}

export function getInterfaceTextLanguage(
  source: string,
  language: InterfaceLanguage
): InterfaceLanguage {
  if (language === "en") return "en";
  const entry = (UI_LABELS as Record<string, Partial<Record<InterfaceLanguage, string>>>)[source];
  return entry?.[language] ? language : "en";
}

export function getInterfaceTextDirection(
  source: string,
  language: InterfaceLanguage
): "ltr" | "rtl" {
  return getInterfaceLanguageDirection(getInterfaceTextLanguage(source, language));
}

function applyDocumentLanguage() {
  if (typeof document === "undefined") return;
  // The catalog currently covers only part of the interface. Keep the document
  // language aligned with its English fallback and mark translated strings at
  // their own elements instead of mislabeling the remaining English content.
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
}

let activeLanguage = readLanguage();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    activeLanguage = readLanguage();
    applyDocumentLanguage();
    notify();
  });
}

export function applyInitialInterfaceLanguage() {
  activeLanguage = readLanguage();
  applyDocumentLanguage();
}

export function setInterfaceLanguage(language: InterfaceLanguage) {
  activeLanguage = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Keep the current tab usable when browser storage is disabled.
  }
  applyDocumentLanguage();
  notify();
}

export function getInterfaceLanguage(): InterfaceLanguage {
  return activeLanguage;
}

export function getInterfaceLanguageDirection(language: InterfaceLanguage): "ltr" | "rtl" {
  return language === "ar" ? "rtl" : "ltr";
}

export function useInterfaceLanguage() {
  const language = useSyncExternalStore<InterfaceLanguage>(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => activeLanguage,
    () => "en"
  );
  const t = (source: string) => {
    if (language === "en") return source;
    const entry = (UI_LABELS as Record<string, Partial<Record<InterfaceLanguage, string>>>)[source];
    return entry?.[language] ?? source;
  };
  const languageFor = (source: string) => getInterfaceTextLanguage(source, language);
  const directionFor = (source: string) => getInterfaceTextDirection(source, language);
  return { language, setLanguage: setInterfaceLanguage, t, languageFor, directionFor };
}
