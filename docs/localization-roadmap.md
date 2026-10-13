# UI localization roadmap

## Existing support and verified gap

The `client/src` React application currently has English interface copy, with no app-level locale catalogs, language preference, or localization framework in the reachable branch and pull-request history. Date and number rendering uses browser defaults in places, but that does not translate the interface or follow a saved app language.

## Implementation plan

1. Inventory and extract visible labels, help, empty states, validation, notifications, and errors from `client/src` and server-originated content rendered by the client. Include free-form API error responses and persisted notification titles/messages. Define a translation strategy for each source; prefer stable message keys with interpolation parameters for server errors and stored notifications. Preserve API values, game titles, release names, paths, and user-entered text.
2. Keep the initial shell catalog dependency-free with English per-key fallback and native browser Intl APIs. Add a full message framework when extraction reaches dynamic messages and plural rules.
3. Add an accessible Display Language control to the existing Settings > Appearance surface. Apply changes immediately and persist the explicit choice in browser-local preferences; on first use, try the browser's preferred locale before falling back to English.
4. Use the regional-format preference for dates, times, numbers, and calendar week structure. Use the interface language for translated text, plural rules, and user-visible alphabetical sorting; keep the two preferences independent and reactive.
5. Mark each translated string with its language and direction. Keep document metadata aligned with the page's primary language while only part of the interface is translated; switch the document language when the page's primary copy uses the selected locale, and derive direction separately. Expand Arabic screen coverage only after reviewing logical layout and core workflows in RTL at narrow and desktop widths.
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

Translate interface labels, help, empty states, validation, notifications, and errors, including server-originated content shown by the client. For free-form API errors and persisted notification titles and messages, use stable translatable message keys with parameters or otherwise ensure those strings are covered by the catalogs. Keep media titles, user names, filenames and paths, commands, API identifiers, protocol values, and other user-supplied content unchanged. Mark translated text with its own `lang` and `dir`; retain English root metadata while English remains the page's primary language, then update root `lang` when the primary copy changes. Use the selected regional format for dates, times, numbers, and calendar week structure; use the interface language for translated copy, plural rules, and alphabetical collation. Every locale must fall back to English for a missing key; CI should check placeholder parity and report missing strings. Arabic ships only after logical layout properties and core workflows are verified in RTL at narrow and desktop widths.

## Implemented in this PR

Settings > Appearance now lets each browser choose regional date, time, and number formatting from browser defaults or the first-pass locale list: Spanish, Simplified Chinese, Hindi, German, Japanese, French, Brazilian Portuguese, Arabic, Korean, Traditional Chinese, Vietnamese, and Indonesian. Dates, times, and relative-time numbers use that choice, and calendar month and week views follow the selected locale’s first day of week. Relative-time wording follows the interface language, keeping the two preferences independent. This is a regional-format preference, not an interface-language translation; the app-wide catalog and RTL work in the roadmap remain outstanding.

Initial Setup and Settings > Appearance now offer a browser-local interface-language selector for twelve first-wave locales. Desktop and mobile navigation, page titles, and the language and regional-format controls use translated labels with English fallback. Each translated string carries its own language and direction metadata; the document remains English and left-to-right while most page content is English. Full RTL layout review is still needed.

## Added in this continuation

The Release Calendar now translates its headings, controls, empty states, and weekday names in the first-wave catalogs, and formats its dates and counts with the selected regional preference. Regional-format changes re-render open screens and keep working in the current tab when browser storage is unavailable. The game download dialog now translates its search filters, sort controls, empty states, release categories, result metrics, relative ages, and update selection/download flow. Server-originated API errors and persisted notification text still need stable translation keys and remain English; full catalog translation and complete RTL layout review remain outstanding.
