# UI localization roadmap

## Existing support and verified gap

The `client/src` React application currently has English interface copy, with no app-level locale catalogs, language preference, or localization framework in the reachable branch and pull-request history. Date and number rendering uses browser defaults in places, but that does not translate the interface or follow a saved app language.

## Implementation plan

1. Inventory and extract visible labels, help, empty states, validation, notifications, and errors from `client/src` into an English source catalog. Preserve API values, game titles, release names, paths, and user-entered text.
2. Add `i18next` with `react-i18next` and ICU plural support, plus a catalog-key coverage check. Keep English as the per-key fallback.
3. Add an accessible Display Language control to the existing Settings > Appearance surface. Apply changes immediately and persist the explicit choice with the existing user preference mechanism; on first use, try the browser's preferred locale before falling back to English.
4. Format dates, numbers, and plurals from the selected locale instead of relying on a different browser locale after a user has chosen an app language.
5. Add the locale files in the ranked order below. Ship Arabic only with correct document `lang`/ `dir` metadata, CSS logical properties, and RTL checks for settings, navigation, dialogs, and tables.
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

Translate interface labels, help, empty states, validation, notifications, and errors. Keep media titles, user names, filenames and paths, commands, API identifiers, protocol values, and other user-supplied content unchanged. Use the selected UI language for date, time, number, and plural formatting. Every locale must fall back to English for a missing key; CI should check placeholder parity and report missing strings. Arabic ships only after the app sets `lang` and `dir`, uses logical layout properties, and verifies the core workflows in RTL at narrow and desktop widths.
