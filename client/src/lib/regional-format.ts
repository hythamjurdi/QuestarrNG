import { formatDistanceToNow } from "date-fns";
import {
  ar,
  de,
  enAU,
  enCA,
  enGB,
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
  { value: "es", label: "Español — Spanish" },
  { value: "zh-CN", label: "简体中文 — Chinese (Simplified)" },
  { value: "hi-IN", label: "हिन्दी — Hindi" },
  { value: "de", label: "Deutsch — German" },
  { value: "ja", label: "日本語 — Japanese" },
  { value: "fr", label: "Français — French" },
  { value: "pt-BR", label: "Português (Brasil) — Brazilian Portuguese" },
  { value: "ar", label: "العربية — Arabic" },
  { value: "ko", label: "한국어 — Korean" },
  { value: "zh-TW", label: "繁體中文 — Chinese (Traditional)" },
  { value: "vi", label: "Tiếng Việt — Vietnamese" },
  { value: "id", label: "Bahasa Indonesia — Indonesian" },
] as const;

const supportedRegionalFormats = new Set<string>(
  REGIONAL_FORMAT_OPTIONS.map((option) => option.value)
);

const dateFnsLocales = {
  ar,
  de,
  en: enUS,
  "en-au": enAU,
  "en-ca": enCA,
  "en-gb": enGB,
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

function getCurrentLocale(): string {
  const regionalLocale = getRegionalLocale();
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

export function getRegionalLocale(): string | undefined {
  try {
    const value = localStorage.getItem(REGIONAL_FORMAT_KEY);
    return value && supportedRegionalFormats.has(value) && value !== "system" ? value : undefined;
  } catch {
    return undefined;
  }
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

  const normalizedLocale = locale.replaceAll("_", "-").toLowerCase();
  // date-fns currently marks zhTW as Monday-first, but CLDR uses Sunday for Taiwan.
  if (normalizedLocale === "zh-tw" || normalizedLocale.startsWith("zh-hant")) return 0;

  return getDateFnsLocale(locale)?.options?.weekStartsOn ?? 1;
}

export function formatRegionalDistanceToNow(date: Date): string {
  const localeCode = getCurrentLocale();
  const locale = getRegionalDateFnsLocale();
  if (locale) return formatDistanceToNow(date, { addSuffix: true, locale });

  const secondsFromNow = (date.getTime() - Date.now()) / 1000;
  const absoluteSeconds = Math.abs(secondsFromNow);
  const units = [
    { unit: "second", seconds: 1 },
    { unit: "minute", seconds: 60 },
    { unit: "hour", seconds: 60 * 60 },
    { unit: "day", seconds: 24 * 60 * 60 },
    { unit: "month", seconds: 30 * 24 * 60 * 60 },
    { unit: "year", seconds: 365 * 24 * 60 * 60 },
  ] as const;
  const selectedUnit =
    [...units].reverse().find(({ seconds }) => absoluteSeconds >= seconds) ?? units[0];
  const relativeTime = new Intl.RelativeTimeFormat(localeCode, { numeric: "auto" });

  return relativeTime.format(Math.round(secondsFromNow / selectedUnit.seconds), selectedUnit.unit);
}
