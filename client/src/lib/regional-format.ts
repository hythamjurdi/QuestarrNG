import { formatDistanceToNow } from "date-fns";
import { useSyncExternalStore } from "react";
import { getInterfaceLanguage } from "./interface-locale";
import {
  ar,
  de,
  enAU,
  enCA,
  enGB,
  enNZ,
  enUS,
  es,
  fr,
  hi,
  id,
  ja,
  ko,
  pt,
  ptBR,
  vi,
  zhCN,
  zhHK,
  zhTW,
} from "date-fns/locale";

export const REGIONAL_FORMAT_KEY = "questarrng.regional-format";

export const REGIONAL_FORMAT_OPTIONS = [
  { value: "system", label: "Use browser settings" },
  { value: "es", nativeName: "Español", englishName: "Spanish" },
  { value: "zh-CN", nativeName: "简体中文", englishName: "Chinese (Simplified)" },
  { value: "hi-IN", nativeName: "हिन्दी", englishName: "Hindi" },
  { value: "de", nativeName: "Deutsch", englishName: "German" },
  { value: "ja", nativeName: "日本語", englishName: "Japanese" },
  { value: "fr", nativeName: "Français", englishName: "French" },
  { value: "pt-BR", nativeName: "Português (Brasil)", englishName: "Brazilian Portuguese" },
  { value: "ar", nativeName: "العربية", englishName: "Arabic" },
  { value: "ko", nativeName: "한국어", englishName: "Korean" },
  { value: "zh-TW", nativeName: "繁體中文", englishName: "Chinese (Traditional)" },
  { value: "vi", nativeName: "Tiếng Việt", englishName: "Vietnamese" },
  { value: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian" },
] as const;

const supportedRegionalFormats = new Set<string>(
  REGIONAL_FORMAT_OPTIONS.map((option) => option.value)
);

const regionalPreferenceListeners = new Set<() => void>();

function normalizeRegionalPreference(value: string | null): string {
  return value && supportedRegionalFormats.has(value) ? value : "system";
}

function readRegionalPreference(): string {
  try {
    return typeof localStorage === "undefined"
      ? "system"
      : normalizeRegionalPreference(localStorage.getItem(REGIONAL_FORMAT_KEY));
  } catch {
    return "system";
  }
}

let activeRegionalPreference = readRegionalPreference();

function notifyRegionalPreferenceListeners() {
  regionalPreferenceListeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== REGIONAL_FORMAT_KEY && event.key !== null) return;
    activeRegionalPreference = readRegionalPreference();
    notifyRegionalPreferenceListeners();
  });
}

export function getRegionalPreference(): string {
  return activeRegionalPreference;
}

export function setRegionalPreference(value: string): void {
  if (!supportedRegionalFormats.has(value)) return;
  activeRegionalPreference = value;
  try {
    localStorage.setItem(REGIONAL_FORMAT_KEY, value);
  } catch {
    // Keep this tab's chosen format active when browser storage is unavailable.
  }
  notifyRegionalPreferenceListeners();
}

export function useRegionalPreference(): string {
  return useSyncExternalStore(
    (listener) => {
      regionalPreferenceListeners.add(listener);
      return () => regionalPreferenceListeners.delete(listener);
    },
    getRegionalPreference,
    () => "system"
  );
}

const dateFnsLocales = {
  ar,
  de,
  en: enUS,
  "en-au": enAU,
  "en-ca": enCA,
  "en-gb": enGB,
  "en-nz": enNZ,
  "en-us": enUS,
  es,
  fr,
  hi,
  id,
  ja,
  ko,
  pt,
  "pt-br": ptBR,
  vi,
  "zh-cn": zhCN,
  "zh-hk": zhHK,
  "zh-tw": zhTW,
} as const;

type RegionalDateFnsLocale = (typeof dateFnsLocales)[keyof typeof dateFnsLocales];

// CLDR supplemental weekData territory overrides, converted to Date weekday indexes.
const sundayFirstRegions = new Set(
  "AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN IS JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW".split(
    " "
  )
);
const saturdayFirstRegions = new Set("AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY".split(" "));

function getLocaleRegion(locale: string): string | undefined {
  const subtags = locale.replaceAll("_", "-").split("-");
  const unicodeExtensionIndex = subtags.findIndex((subtag, index) => index > 0 && subtag === "u");

  if (unicodeExtensionIndex >= 0) {
    const unicodeExtension = subtags.slice(unicodeExtensionIndex + 1);
    const regionOverrideIndex = unicodeExtension.indexOf("rg");
    const regionOverride =
      unicodeExtension[regionOverrideIndex + 1]?.match(/^([a-z]{2}|\d{3})zzzz$/i)?.[1];
    if (regionOverride) return regionOverride.toUpperCase();
  }

  const baseSubtags =
    unicodeExtensionIndex < 0 ? subtags.slice(1) : subtags.slice(1, unicodeExtensionIndex);
  return baseSubtags.find((subtag) => /^[a-z]{2}$|^\d{3}$/i.test(subtag))?.toUpperCase();
}

function getRegionWeekStartsOn(locale: string): number | undefined {
  const region = getLocaleRegion(locale);
  if (!region) return undefined;

  if (sundayFirstRegions.has(region)) return 0;
  if (saturdayFirstRegions.has(region)) return 6;
  if (region === "MV") return 5;

  // Monday is CLDR's default for regions without an explicit first-day override.
  return 1;
}

function getCurrentLocale(preference = getRegionalPreference()): string {
  const regionalLocale = getRegionalLocale(preference);
  if (regionalLocale) return regionalLocale;

  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  } catch {
    return "en-US";
  }
}

function getDateFnsLocale(locale: string): RegionalDateFnsLocale | undefined {
  const normalizedLocale = locale.replaceAll("_", "-").toLowerCase();
  const exactLocale = dateFnsLocales[normalizedLocale as keyof typeof dateFnsLocales];
  if (exactLocale) return exactLocale;

  if (normalizedLocale.startsWith("zh-hant")) return zhTW;
  if (normalizedLocale.startsWith("zh")) return zhCN;

  const language = normalizedLocale.split("-")[0] ?? "en";
  return dateFnsLocales[language as keyof typeof dateFnsLocales];
}

export function getRegionalLocale(preference = getRegionalPreference()): string | undefined {
  return preference === "system" ? undefined : preference;
}

const rightToLeftScripts = new Set([
  "Adlm",
  "Arab",
  "Hebr",
  "Mand",
  "Mend",
  "Nkoo",
  "Rohg",
  "Samr",
  "Syrc",
  "Thaa",
  "Yezi",
]);

const rightToLeftLanguages = new Set(["ar", "ckb", "fa", "he", "ks", "ps", "sd", "ug", "ur", "yi"]);

export function getRegionalDirection(locale: string): "ltr" | "rtl" {
  try {
    if (rightToLeftScripts.has(new Intl.Locale(locale).maximize().script ?? "")) return "rtl";
  } catch {
    // Fall back to the language subtag for older runtimes or malformed locales.
  }

  return rightToLeftLanguages.has(locale.replaceAll("_", "-").split("-")[0]?.toLowerCase() ?? "")
    ? "rtl"
    : "ltr";
}

export function getRegionalCollator(
  options?: Intl.CollatorOptions,
  preference = getRegionalPreference()
): Intl.Collator {
  return new Intl.Collator(getCurrentLocale(preference), { sensitivity: "base", ...options });
}

export function formatRegionalNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  preference = getRegionalPreference()
): string {
  return new Intl.NumberFormat(getCurrentLocale(preference), options).format(value);
}

export function formatRegionalDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
  preference = getRegionalPreference()
): string {
  return new Intl.DateTimeFormat(getCurrentLocale(preference), {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

export function formatRegionalPercent(
  percent: number,
  options?: Omit<Intl.NumberFormatOptions, "style">,
  preference = getRegionalPreference()
): string {
  return new Intl.NumberFormat(getCurrentLocale(preference), {
    style: "percent",
    ...options,
  }).format(percent / 100);
}

export function getRegionalDateFnsLocale(): RegionalDateFnsLocale | undefined {
  return getDateFnsLocale(getCurrentLocale());
}

export function getRegionalWeekStartsOn(): number {
  const locale = getCurrentLocale();

  try {
    const localeWithWeekInfo = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay =
      localeWithWeekInfo.getWeekInfo?.().firstDay ?? localeWithWeekInfo.weekInfo?.firstDay;

    // Intl uses ISO numbering (Monday=1 through Sunday=7); Date uses Sunday=0.
    if (firstDay !== undefined && Number.isInteger(firstDay) && firstDay >= 1 && firstDay <= 7) {
      return firstDay % 7;
    }
  } catch {
    // Older browsers may not expose Intl.Locale week data.
  }

  const regionWeekStartsOn = getRegionWeekStartsOn(locale);
  if (regionWeekStartsOn !== undefined) return regionWeekStartsOn;

  const normalizedLocale = locale.replaceAll("_", "-").toLowerCase();
  // date-fns currently marks zhTW as Monday-first, but CLDR uses Sunday for Taiwan.
  if (normalizedLocale === "zh-tw" || normalizedLocale.startsWith("zh-hant")) return 0;

  return getDateFnsLocale(locale)?.options?.weekStartsOn ?? 1;
}

export function formatRegionalDistanceToNow(date: Date): string {
  const interfaceLocale = getDateFnsLocale(getInterfaceLanguage()) ?? enUS;
  // Keep date-fns wording and plural rules, but format its count with the separate regional choice.
  const regionalizedLocale = {
    ...interfaceLocale,
    formatDistance: (
      token: Parameters<typeof interfaceLocale.formatDistance>[0],
      count: number,
      options?: Parameters<typeof interfaceLocale.formatDistance>[2]
    ) =>
      interfaceLocale
        .formatDistance(token, count, options)
        .replace(String(count), formatRegionalNumber(count, { useGrouping: false })),
  };

  return formatDistanceToNow(date, { addSuffix: true, locale: regionalizedLocale });
}
