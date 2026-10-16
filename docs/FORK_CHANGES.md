# What changed in QuestarrNG

QuestarrNG is Snapetech's maintained fork of
[Doezer/Questarr](https://github.com/Doezer/Questarr). This guide summarizes
the main product and maintenance additions made for the fork. The
[changelog](CHANGELOG.md) remains the complete versioned record, including
individual fixes and security updates.

## Why maintain QuestarrNG

The fork keeps a SeerrNG-compatible provider and a separately released game
manager under active development. On 2026-10-16, the inspected
[Doezer/Questarr `main` commit](https://github.com/Doezer/Questarr/commit/db6c6f77a055fd548bc85a250e467621adab532c)
included a generic, user-scoped integration API for clients such as Playnite,
but did not expose the SeerrNG provider contract. QuestarrNG supplies a
versioned capability handshake, a stable IGDB catalog, and request-contract
v2: it keeps SeerrNG's request ID and selected PC operating system/architecture
attached through acquisition, reports lifecycle state, supports retry/cancel,
and streams imported files through authenticated request-scoped routes. These
boundaries let SeerrNG retain approval, quotas, ownership, and requester access
while QuestarrNG owns game acquisition and file delivery. See the
[integration guide](SEERRNG-INTEGRATION.md), the current
[request-contract v2 OpenAPI contract](contracts/seerrng-v2.openapi.yaml), and
the [provider v1 contract](contracts/seerrng-v1.openapi.yaml).

QuestarrNG also develops the standalone features below, including platform-
scoped library workflows, play tracking, RomM and Playnite connections,
acquisition safety, optional PostgreSQL, and fork-owned multi-platform
releases. Upstream and this fork can converge or diverge with later changes;
this snapshot is a dated comparison, not a permanent claim about Questarr.

### When the fork would no longer be required

SeerrNG could depend on upstream Questarr directly after upstream provides the
current provider handshake and request contract (including stable external
request identity, selected PC variant, lifecycle actions/status, and
authenticated request-scoped file delivery), and SeerrNG supports that
upstream contract or an adapter. Any standalone QuestarrNG capability still
required by operators would also need to be available upstream or no longer be
a maintained requirement. We can then compare release cadence, migration
behavior, security support, and deployment targets before moving the default
dependency. Recheck this guide against upstream and the SeerrNG consumer when
the contract changes.

The Snapetech fork was created in September 2026. The v1.5.0 release was not
published; its completed work shipped in v1.6.0. Releases from v1.6.0 through
[v2.1.1](https://github.com/snapetech-org/QuestarrNG/releases/tag/v2.1.1)
added the capabilities below.

## Product capabilities

### Library and discovery

- Platform preferences now scope discovery, library filtering, adding games,
  download searches, and import eligibility. Users can hide owned or shelved
  titles by default and scan platform-specific local roots to reconcile files.
- The **Playing** workflow records personal journal entries, milestones,
  screenshots, and Steam achievements. Game details include DLC and expansion
  entries, and discovery can use the exact release date for a selected IGDB
  platform.
- Users can keep private lists without changing a game's library status, see
  when a tracked game has an available update, and view HowLongToBeat estimates
  for close title matches. Optional RAWG discovery keeps its IDs separate from
  IGDB, while a zero IGDB rating remains a real score.
- A global release-name blacklist applies across manual search, automatic
  search, and AI-assisted release selection. Existing genre, year, platform,
  and content filters continue to apply to discovery results.

### Acquisition, import, and safety

- Post-processing moves or copies completed downloads into configured library
  locations and handles archive extraction. RomM imports can be mapped to
  RomM's platform folders with configurable transfer and conflict behavior.
- Prowlarr feed diagnostics test each enabled torrent or usenet indexer
  separately. HTTP Prowlarr/API-key forwarding is opt-in, and indexer/download
  diagnostics explain when credentials are withheld for an insecure transport.
- Search supports public HTTPS Hydra-format JSON catalogs, verified torrent
  file-type filters, saved release-scoring profiles, and direct `.torrent` or
  `.nzb` downloads. Users can also send a result to a configured downloader,
  choose updates and small extras, and save preferred release groups.
- Archive imports reject traversal and link entries and enforce configured
  entry-count and expanded-size limits. Optional VirusTotal hash lookups and
  local ClamAV scans can quarantine flagged files before they enter the library.
  See the [import setup and scanning guide](IMPORTS.md) for operator steps and
  scanner behavior.

### Integrations

- **Playnite:** the extension can synchronize the local library, promote
  installed games to owned, and submit a request that enters Questarr's normal
  search and download workflow. See the
  [Playnite extension guide](../extensions/playnite-questarr/README.md).
- **RomM:** matched ROM downloads can be routed to mapped RomM platform folders.
- **SeerrNG:** the versioned provider API supplies an IGDB catalog and
  request-scoped PC-game acquisition. It carries an external request ID and
  selected operating system/architecture through search and download, reports
  lifecycle status, and exposes imported files through authenticated,
  request-scoped streaming. See the
  [integration guide](SEERRNG-INTEGRATION.md),
  [API reference](API.md#integration-api-external-clients), and
  [current OpenAPI contract](contracts/seerrng-v2.openapi.yaml).
- **Real-Debrid:** OAuth device authorization connects a downloader without
  storing credentials in the browser. Completed files are staged under a
  configured local path before Questarr imports them.
- The interface supports English and twelve translated locales, including
  localized settings, forms, notifications, and app-owned API/import
  diagnostics, with regional date and number formats and right-to-left layout
  support.

### Deployment and operations

- SQLite remains the zero-configuration default; PostgreSQL is available as an
  optional backend. See [database setup](DATABASE.md).
- The maintained release image is published for `linux/amd64` and
  `linux/arm64`. QuestarrNG also maintains a self-contained .NET 10 Windows
  service host, a Helm chart, and home-server installation definitions.
- The production image and Compose templates run the service as a non-root
  user by default; hardened Compose and Helm options add a read-only root
  filesystem and dropped Linux capabilities. Published images include
  SBOM and provenance attestations. See the
  [security overview](THREAT_MODEL.md),
  [Proxmox guide](PROXMOX.md), and
  [home-server app guides](HOME_SERVER_APPS.md).
- Releases use curated user-facing notes; dependency and code scanning are
  part of the maintained release process. See the
  [security policy](SECURITY.md) and
  [release-note guide](../release-notes/README.md).

## Release timeline

| Release           | Main additions                                                                                                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.6.0–1.6.1**   | RomM import routing, Prowlarr feed diagnostics and HTTP controls, safer library and archive imports, multi-architecture release images, and fork-owned installation guidance.                                                                                                                                  |
| **1.7.0–1.7.3**   | Exact platform release dates in the SeerrNG catalog, clearer indexer/downloader diagnostics, hardened outbound and proxy requests, the .NET 10 Windows service, and maintained release-note publication.                                                                                                       |
| **1.8.0–1.8.3**   | Versioned SeerrNG OpenAPI contract, scoped and expiring integration keys, bounded archive extraction, rootless container settings, SBOM/provenance attestations, and dependency/security maintenance.                                                                                                          |
| **1.9.0–1.9.1**   | Platform-scoped library and discovery, the Playing journal and Steam achievements, DLC/expansion details, release blacklisting, per-file categories and installed versions, and optional pre-import VirusTotal/ClamAV checks.                                                                                  |
| **1.9.2–1.9.3**   | SeerrNG request-contract v2 and authenticated request-scoped bundles, plus release selection and acquisition refinements.                                                                                                                                                                                      |
| **1.10.0–1.11.0** | Real-Debrid OAuth and local staging, exact SeerrNG IGDB identity, verified Steam ownership and play-time estimates, browser-local language selection, regional formatting, locale-aware calendars, and right-to-left rendering.                                                                                |
| **2.0.0**         | Personal game lists, direct torrent/NZB downloads, update and extra selection, HowLongToBeat estimates, update availability, torrent file-type search, Hydra JSON catalogs, optional RAWG discovery, saved release scoring, a PostgreSQL-to-SQLite migration, and twelve translated locales alongside English. |
| **2.1.0–2.1.1**   | Complete version-tag release assets across GHCR, Windows, and Helm; native amd64/arm64 image builds; clearer localized interface and API diagnostics; reliable settings reloads; and paced IGDB searches that wait instead of failing on rate limits.                                                          |

For every released change, including fixes and action-required upgrade notes, use
the [full changelog](CHANGELOG.md) and the
[GitHub releases](https://github.com/snapetech-org/QuestarrNG/releases).

## Current SeerrNG provider compatibility

QuestarrNG 2.1.1 advertises SeerrNG `apiVersion: 1` and
`requestContractVersion: 2`. It supports the IGDB catalog, PC acquisition,
request retry/cancel, single-file streaming, and request-scoped `.tar.gz`
bundles for multi-file imports, plus exact request identity and Steam ownership
estimates. Real-Debrid downloads can be staged locally before import. The
handshake reports emulation acquisition as unsupported. See the
[SeerrNG release note](https://github.com/snapetech-org/seerrng/blob/main/release-notes/questarr-catalog-estimates-and-bundles.md)
and the current [QuestarrNG provider contract](contracts/seerrng-v2.openapi.yaml).

### Convergence matrix: what upstream needs before the fork can retire

This is a replacement checklist, not a claim that every listed feature is
absent upstream. The SeerrNG provider gap was checked on 2026-10-16 against
[Doezer/Questarr `main` at `db6c6f7`](https://github.com/Doezer/Questarr/commit/db6c6f77a055fd548bc85a250e467621adab532c).
That snapshot has a generic, user-scoped integration API for clients such as
Playnite, but it does not implement QuestarrNG's SeerrNG provider contract.
The comparison point is visible in upstream's
[integration routes](https://github.com/Doezer/Questarr/blob/db6c6f77a055fd548bc85a250e467621adab532c/server/routes/integration.ts)
and [API documentation](https://github.com/Doezer/Questarr/blob/db6c6f77a055fd548bc85a250e467621adab532c/docs/API.md#integration-api-external-clients).

| Gate                                               | What a replacement must provide                                                                                                                                                                                                                                           | QuestarrNG 2.1.1                                                                                                                                 | Retirement check                                                                                                                                                                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SeerrNG provider contract — hard gate**          | A compatible capability handshake (`apiVersion: 1`, `requestContractVersion: 2`); stable external request identity and PC variant; IGDB catalog; request status, retry, and cancel; scoped credentials; authenticated request-scoped single-file and multi-file delivery. | Shipped; documented in the [integration guide](SEERRNG-INTEGRATION.md) and [OpenAPI contract](contracts/seerrng-v2.openapi.yaml).                | Upstream implements the contract, and the supported SeerrNG release passes an end-to-end acquisition and file-delivery check against it. The generic Playnite API in the reviewed upstream snapshot does not meet this gate. |
| **Library and discovery — operator gate**          | Any required platform-scoped views, local-folder discovery, Steam wishlist sync, Playing journal/milestones/screenshots/achievements, private lists, update indicators, DLC/expansion details, RAWG, or HowLongToBeat behavior.                                           | Shipped; see [product capabilities](#product-capabilities) and the [changelog](CHANGELOG.md).                                                    | Compare the exact upstream release against the features each installation uses. Upstream parity or an explicit decision to retire each missing capability is required.                                                       |
| **Interface and localization — operator gate**     | English and twelve translated locales, browser-local language selection, regional formatting, RTL layouts, and localized app-owned diagnostics in the languages operators use.                                                                                            | Shipped; see the [localization roadmap](localization-roadmap.md).                                                                                | Review important flows in the required languages and layouts against the target release. Accept any missing locale or untranslated surface explicitly.                                                                       |
| **Search, downloads, and imports — operator gate** | Required indexers and download clients, Hydra catalogs, file-type search, release scoring and groups, direct torrent/NZB downloads, update bundles, Real-Debrid, RomM routing, and import safety/scanning.                                                                | Shipped; see [acquisition, import, and safety](#acquisition-import-and-safety), [indexer setup](INDEXERS.md), and [import guidance](IMPORTS.md). | Verify each used source, client, selection rule, and import path against the target release. Preserve a migration path for existing downloads and library files.                                                             |
| **Database and data migration — cutover gate**     | A supported source/target database plan with backups, verified migrations, and recovery steps; operators using PostgreSQL must be able to keep or deliberately migrate that data.                                                                                         | SQLite by default, optional PostgreSQL, and documented migrations in both directions; see [database guidance](DATABASE.md).                      | Run a copy of the installation's real migration path and confirm library, settings, and integration data before changing the production dependency.                                                                          |
| **Deployment and maintenance — operator gate**     | The installation targets and release/security cadence operators depend on, including amd64/arm64 containers, Windows service, Helm or home-server definitions where used, and trustworthy versioned releases.                                                             | Shipped; see [deployment and operations](#deployment-and-operations), [operations guidance](OPERATIONS.md), and [security policy](SECURITY.md).  | Confirm target images/installers, update and rollback procedures, security support, and release timing with the specific upstream release.                                                                                   |

Only the SeerrNG contract is a known protocol blocker in the reviewed snapshot.
The other rows require an installation-specific comparison: a feature can leave
this fork when upstream provides it or when its operators no longer require it.
Recheck upstream and the SeerrNG consumer at the time of any migration; the
comparison above is tied to the commit recorded here.
