# SnapeTech MCP

QuestarrNG does not run an MCP server inside the application. The shared
`snapetech-mcp` process calls its existing SeerrNG integration API over MCP
stdio transport. Its quickstart is in the sibling `snapetech-mcp/README.md`.

## Tools and API access

| MCP tool | QuestarrNG endpoint | Result |
| --- | --- | --- |
| `questarrng_status` | `GET /api/health` | Reachability only. |
| `questarrng_search_catalog` | `GET /api/integration/seerrng/v1/catalog/search-page` | Bounded IGDB search with cursor pagination and optional platform, genre, and year filters. |
| `questarrng_list_popular_catalog` | `GET /api/integration/seerrng/v1/catalog/popular-page` | Bounded popular-game page with optional platform, genre, and year filters. |
| `questarrng_list_catalog_platforms` | `GET /api/integration/seerrng/v1/catalog/platforms` | Projected IGDB platform names and IDs. |
| `questarrng_get_catalog_game` | `GET /api/integration/seerrng/v1/catalog/games/{igdbId}` | Bounded metadata for one validated IGDB ID. |
| `questarrng_lookup_library` | `GET /api/integration/seerrng/v1/library/lookup` | Checks up to twenty IGDB IDs in the authenticated account's visible library. |

Create a dedicated API key in QuestarrNG and set its scope to
`integration:seerrng` with an expiry. Configure `SNAPETECH_MCP_APPS=questarrng`,
`SNAPETECH_MCP_QUESTARRNG_URL=<QuestarrNG base URL>`, and
`SNAPETECH_MCP_QUESTARRNG_API_KEY=<the new key>` in the MCP host's protected
environment. The bridge sends the key in `X-Api-Key`.

## Credential and data boundaries

The scoped key is limited to the SeerrNG integration route family and expires
(new keys default to 90 days). That route family also contains request creation,
retry, and cancel operations. The MCP adapter only calls GET routes, but the
key is not a read-only credential if used outside this bridge. Keep the key
dedicated to MCP and rotate or revoke it from QuestarrNG's API-key settings.

The lookup follows the authenticated user's visible library and QuestarrNG's
hidden/content-filter rules. Results contain only IGDB ID, status, and
deliverability. Catalog discovery and game detail can query QuestarrNG's configured
IGDB service. Optional Steam app IDs in the library lookup can cause an outbound request
to Steam. Results return only selected catalog fields and ownership/status flags. Keep
the MCP process attached to a trusted local client and never expose its stdio
transport through a TCP bridge or reverse proxy.

## Competitor feature coverage

The upstream [Questarr](https://github.com/Doezer/Questarr) combines game
discovery and collection tracking with indexer/download-client automation.
QuestarrNG adds platform-scoped discovery, play
journals and achievements, release scoring, download monitoring and post-processing,
RomM imports, Playnite sync, and request-scoped SeerrNG acquisition. [Playnite](https://api.playnite.link/docs/manual/gettingStarted/gettingStartedOverview.html) is an
adjacent multi-store library/launcher with extensions and playtime tracking;
[RomM](https://github.com/rommapp/romm) is a retro library and player. See the [QuestarrNG feature list](../../README.md#list-of-features) for the fuller
app-side inventory. They overlap with different workflows rather than replacing the
acquisition manager.

Snapetech MCP covers bounded IGDB discovery and account-visible library lookup. It
deliberately does not expose request-status reads: QuestarrNG's GET request view can
reconcile and persist integration state. Download queues, play history, and download,
retry, cancel, or import actions need separate route and authorization reviews.

**Confidence:** high for the documented game-management and integration-route surfaces; moderate for direct competitor comparison because Playnite and RomM cover adjacent workflows.

Source contract: `docs/SEERRNG-INTEGRATION.md`,
`docs/SECURITY_ASSESSMENT.md`, `server/routes/integration.ts`, and
`server/routes/api-keys.ts`.
