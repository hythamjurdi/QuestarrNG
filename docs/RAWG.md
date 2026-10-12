# Optional RAWG discovery

QuestarrNG can use RAWG as an additional game search and discovery provider.
Configure the API key under **Settings → Integrations → RAWG Game Database**.
The key is encrypted in the system configuration table and never sent back to
the browser. Use **Test connection** before saving; remove the provider from the
same settings card at any time.

Discover keeps IGDB and RAWG in separate tabs. Each provider has its own game
identity. RAWG IDs are stored separately from IGDB IDs, so enabling RAWG does
not change existing IGDB mappings or the SeerrNG request contract. When a RAWG
game is already in the library, status and detail actions target that record.

RAWG requests are serialized to respect its public API rate limits. Discovery
lists are cached briefly; a key change or removal clears the server cache.
Adult and age restricted results use the same per-user filters as IGDB.

RAWG's free API plan is for noncommercial projects, has a monthly request cap,
and requires an active RAWG link on pages that use its data or images. Review
the current [API documentation and terms](https://rawg.io/apidocs) before
using it. The application sidebar provides that attribution link.
