# UI localization roadmap

## Existing support and verified gap

The `client/src` React application currently has English interface copy, with no app-level locale catalogs, language preference, or localization framework in the reachable branch and pull-request history. Date and number rendering uses browser defaults in places, but that does not translate the interface or follow a saved app language.

## Implementation plan

1. Inventory and extract visible labels, help, empty states, validation, notifications, and errors from `client/src` and server-originated content rendered by the client. Include free-form API error responses and persisted notification titles/messages. Define a translation strategy for each source; prefer stable message keys with interpolation parameters for server errors and stored notifications. Preserve API values, game titles, release names, paths, and user-entered text.
2. Add `i18next` with `react-i18next` and ICU plural support, plus a catalog-key coverage check. Keep English as the per-key fallback.
3. Add an accessible Display Language control to the existing Settings > Appearance surface. Apply changes immediately and persist the explicit choice with the existing user preference mechanism; on first use, try the browser's preferred locale before falling back to English.
4. Format dates, times, numbers, and plurals from the selected locale instead of relying on a different browser locale after a user has chosen an app language. Use that locale for user-visible sorting too, preferably through a shared `Intl.Collator`.
5. Add the locale files in the ranked order below. Set the document `lang` to every selected locale and derive `dir` separately so right-to-left locales use RTL layout. Make calendar weekday order and week boundaries follow the selected locale. Ship Arabic only after verifying CSS logical properties and RTL behavior for settings, navigation, dialogs, and tables.
6. For each PR that changes `client/src`, include the required running UI screenshot at desktop and narrow widths.

## First-pass locale order

This is a practical rollout order, not a claim about these apps' actual user base. Product-level language analytics are not available. It combines global speaker estimates with online-content usage, and keeps the requested Arabic and Asian-language coverage in the first waves:

1. Spanish (es; es-MX where the product already distinguishes it)
2. Simplified Chinese (zh-Hans / zh-CN)
3. Hindi (hi)
4. German (de)
5. Japanese (ja)
6. French (fr)
7. Brazilian Portuguese (pt-BR)
8. Arabic (ar; requires right-to-left layout support)
9. Korean (ko)
10. Traditional Chinese (zh-Hant / zh-TW)
11. Vietnamese (vi)
12. Indonesian (id)

The World Bank's 2025 report estimates Mandarin Chinese, Hindi, and Spanish at 15%, 7.6%, and 6.9% of the global population respectively; its online-content data also places German, Chinese, and Japanese among the leading languages. [World Bank, Digital Progress and Trends Report 2025](https://documents1.worldbank.org/curated/en/099112525160536089/pdf/P505350-59c98ca8-0803-4f23-b470-17f3dab010ab.pdf). W3Techs tracks website content-language share rather than app users. [W3Techs content-language survey](https://w3techs.com/technologies/cross/content_language%20/ranking). Reorder this list if maintainers later receive reliable demand signals.

## Translation boundaries and acceptance

Translate interface labels, help, empty states, validation, notifications, and errors, including server-originated content shown by the client. For free-form API errors and persisted notifications, use stable translatable message keys with parameters or otherwise ensure those messages are covered by the catalogs. Keep media titles, user names, filenames and paths, commands, API identifiers, protocol values, and other user-supplied content unchanged. Every locale must update document `lang`; derive `dir` separately. Use the selected UI language for date, time, number, plural, and collation behavior, and use its first day of week and weekday order in the calendar. Every locale must fall back to English for a missing key; CI should check placeholder parity and report missing strings. Arabic ships only after logical layout properties and core workflows are verified in RTL at narrow and desktop widths.

## Implemented in this PR

Settings > Appearance now lets each browser choose regional date, time, and number formatting from browser defaults or the first-pass locale list: Spanish, Simplified Chinese, Hindi, German, Japanese, French, Brazilian Portuguese, Arabic, Korean, Traditional Chinese, Vietnamese, and Indonesian. Existing locale-aware displays use that choice. This is a regional-format preference, not an interface-language translation; the app-wide catalog and RTL work in the roadmap remain outstanding.
