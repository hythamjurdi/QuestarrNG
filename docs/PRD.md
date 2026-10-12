# QuestarrNG — Product Requirements Document

- **Version:** 1.1
- **Last reviewed:** 2026-10-04
- **Maintainer:** Snapetech QuestarrNG
- **Audience:** Project owner, contributors, and coding agents
- **Status:** Living product brief; planned work has no release-date commitment.

---

## 1. Problem Statement

There is no automated, self-hosted tool to connect torrent/usenet **indexers** and **download clients** specifically for video games. Tools like Sonarr and Radarr solve this for TV and movies; Questarr fills the same gap for games.

Without Questarr, a user who wants to automatically download a newly released game must manually search indexers, copy magnet/NZB links, and paste them into a download client — repeatedly, for every game, every update. Questarr eliminates that loop.

---

## 2. Vision

**Questarr is the \*Arr-ecosystem equivalent for video games.** It gives self-hosters a single, browser-based dashboard to discover, track, download, and organize their game library — automatically.

The long-term vision is to be the **connective tissue of the self-hosted gaming stack**: integrated with indexers, download clients, external libraries (Steam, GOG), media management tools (Playnite, RomM, Gameyfin), and release trackers (xREL), while staying lightweight enough to run on a NAS or home server.

---

## 3. Users & Personas

### Primary — The Automated Downloader

A self-hoster who wants a set-it-and-forget-it pipeline. They add a game to their wishlist; Questarr searches indexers on a schedule, picks the best release, sends it to qBittorrent/SABnzbd/etc., monitors completion, and moves files to the right folder. They should rarely need to intervene.

**Core job:** Don't make me think about the download pipeline.

### Secondary — The Library Centralizer

A collector who already owns games on Steam, GOG, or a local filesystem and wants a single place to track everything. They use Questarr as a unified library view and may use it to fill gaps (games not on storefronts) via download.

**Core job:** Show me everything I own in one place, regardless of source.

### Tertiary — The Retro Gamer

A user who wants to automate ROM downloads for retro gaming, feeding tools like RomM or ES-DE that read from a local path.

**Core job:** Keep my ROM library up to date without manual searching.

---

## 4. Shipped in 1.5.0

QuestarrNG is a maintained fork of Questarr. The following capabilities are
available in the current release; the fork's release-by-release additions are
summarized in [FORK_CHANGES.md](FORK_CHANGES.md).

- IGDB discovery and metadata, Steam wishlist import and scheduled sync, RSS
  feeds refreshed at startup and hourly, and xREL release monitoring.
- Wanted, Owned, Playing, Completed, and Shelved statuses, ratings, notes,
  platform/content filters, sorting, and Backlog roulette.
- Playing journal, milestones, screenshots, and Steam achievements; game details
  include DLC/expansions, crack status, Time to Beat, PCGamingWiki, and NexusMods.
- Root-folder discovery with scan progress, automatic rescans, and IGDB review
  for unmatched folders. Existing files stay in place.
- Installed-version tracking, populated from completed downloads or edited in
  game details. Older update releases do not produce newer-version alerts.

- Add games manually, through IGDB discovery, from a Steam wishlist, or from a
  scan of configured local platform roots
- Track wanted, owned, playing, completed, and shelved titles with ratings and
  notes; hide owned or shelved results where appropriate
- Record Playing journal entries, milestones, screenshots, and Steam
  achievements; view game DLC and expansions
- Scope discovery, library views, downloads, and import eligibility by platform

- Torznab, Newznab, and G4U indexers, plus Prowlarr synchronization with saved
  connection, category, and priority defaults.
- Manual and scheduled searches, auto-download, release blacklisting, preferred
  release groups, source-page links, and per-game target platforms.
- qBittorrent, Transmission, rTorrent, Deluge, Synology Download Station,
  SABnzbd, and NZBGet integrations with live download progress.
- Optional experimental AI release analysis using TypeSafe/Jev through
  OpenRouter with the user's API key.

- IGDB discovery and metadata enrichment, including exact platform release
  dates, Steam App ID matching, PCGamingWiki links, and NexusMods trends
- RSS and xREL release feeds, with platform, genre, year, and content filters

- Configurable library root, rename pattern, copy/move/hardlink transfer,
  hardlink fallback, archive extraction, path mappings, and add-on organization.
- Manual review for failed or ambiguous imports, archive passwords, and orphaned
  downloads; import history records task results.
- Optional VirusTotal and ClamAV checks quarantine detected files before import;
  incomplete ClamAV scans wait for informed manual review.
- Playing, Shelved, and Completed statuses survive download and import updates.

- Torznab and Newznab search, direct configuration or Prowlarr synchronization
- Per-indexer feed diagnostics and manual per-release download actions
- Preferred release groups/platforms and a global release-name blacklist

### Download Client Integration

- Supported torrent and usenet clients, including qBittorrent, Transmission,
  rTorrent, Deluge, Synology Download Station, SABnzbd, and NZBGet
- Download status tracking, progress updates, and configurable cleanup
- Automated post-processing, archive extraction, and optional pre-import
  VirusTotal or ClamAV checks
- Optional RomM folder routing for matched ROM imports

### Automation

- Scheduled search for wanted games and download-completion processing
- xREL and RSS release monitoring with direct add-to-library actions

### Calendar

- Release calendar for tracked games

### Stats

- Library and download statistics dashboard

### Settings & Config

- Platform and content preferences, release selection, indexer/downloader
  configuration, and system logs
- In-app and external notifications, including Apprise providers
- Library and download statistics

### Infrastructure

- JWT authentication and a REST/Socket.io API
- SQLite by default, with PostgreSQL as an optional backend
- Docker images for `linux/amd64` and `linux/arm64`, plus Helm and home-server
  install definitions
- A self-contained .NET 10 Windows service host for the Node.js application
- Rootless container options, SSRF and filesystem boundary checks, and
  published SBOM/provenance attestations
- Playnite integration and a versioned SeerrNG catalog/acquisition provider

---

## 5. Roadmap and delivery status

This section adapts the upstream roadmap to the current QuestarrNG codebase.
Items marked shipped are maintained capabilities; the remaining ideas are
proposals without a promised release date.

### Smart backlog

### P0 — Post-processing pipeline _(shipped)_

**Delivered:** Completed downloads can be moved or copied into configured
library locations, archives can be extracted, and import status is tracked.
Path and archive safety checks apply before files are written. Optional
VirusTotal or ClamAV checks can quarantine flagged files before import.

See the [import and security details](IMPORTS.md) and the
[fork history](FORK_CHANGES.md#acquisition-import-and-safety).

### External integrations

### P1 — Smart game backlog (version-aware updates) _(planned)_

### Ongoing quality

**Feature:**

- Track the last downloaded version per game (parsed from release title)
- On each scheduled search, compare new results against the stored version
- Notify the user only when a strictly higher version is found (e.g. v1.0 → v1.1)
- Option to auto-download upgrades

**Why:** Moves Questarr from "download once" to "keep library current" — the full \*Arr experience.

---

### P2 — Direct download support (Real-Debrid and similar) _(proposed)_

**Problem:** Some users prefer direct download services (Real-Debrid, AllDebrid, etc.) over traditional torrent/usenet pipelines — no seeding required.

**Feature:**

- New downloader type: "direct download / debrid service"
- Resolve magnet links or torrent files through the debrid API into direct HTTP links
- Trigger download to a local downloader or direct to server path
- Surface in the existing downloader configuration UI

**Why:** Expands the user base to those who don't run a torrent client, and complements the existing pipeline without replacing it.

---

### P3 — External library sync _(partly shipped)_

**Shipped:** Steam wishlist import and local platform-root scanning are
available. Playnite can synchronize its library and promote installed games.
These features do not import a user's complete Steam or GOG owned-game library.

**Remaining proposal:** Import complete owned-game libraries from Steam or GOG,
with source-aware duplicate handling and periodic synchronization if their
available APIs and local data formats support it.

**Why:** Serves the Library Centralizer persona and makes Questarr useful even for users who don't download anything.

---

### P4 — Integrations with external tools _(partly shipped)_

**Problem:** Self-hosters already use tools like Playnite, Gameyfin, and RomM. Questarr should fit into those ecosystems rather than compete with them.

**Integrations:**

- **Playnite — shipped:** the extension synchronizes the local library, can
  promote installed games to owned, and can submit requests into Questarr's
  existing search/download workflow. See the
  [Playnite guide](../extensions/playnite-questarr/README.md).
- **RomM — shipped:** matched ROM imports can be routed to configured RomM
  platform folders.
- **SeerrNG — shipped:** a versioned, authenticated provider API supplies an
  IGDB catalog and request-scoped PC-game acquisition. See
  [SEERRNG-INTEGRATION.md](SEERRNG-INTEGRATION.md).
- **Gameyfin and user-defined webhooks — proposals:** neither is currently a
  supported integration.

**Why:** Lowers switching cost and increases stickiness for users already in the self-hosted ecosystem.

---

### P5 — Indexer page links _(shipped)_

**Problem:** When a user wants more context about a specific release (description, NFO, comments), they have to manually navigate to the indexer.

**Feature:**

- Store and display a direct link to the release page on the indexer
- Surface as a "View on indexer" button in the download/search result UI

**Why:** Small lift, high user request frequency. Reduces tab-switching for power users who want to inspect releases before committing.

---

### P6 — PostgreSQL support _(shipped)_

SQLite remains the default database, and PostgreSQL is available as an optional
backend. See [DATABASE.md](DATABASE.md) for setup and migration guidance.

**Feature:**

- Re-introduce PostgreSQL as an optional database backend
- Maintain SQLite as the default (zero-config)
- Abstract the Drizzle schema to work cleanly on both dialects
- Document migration path from SQLite to PostgreSQL

**Why:** Enables production-grade deployments and unblocks potential multi-user or multi-instance scenarios.

---

### Ongoing — quality, design, and UX

These are continuous product-quality goals rather than dated release promises.

- Mobile responsiveness: thumb-first navigation, touch-safe density, progressive disclosure on small screens
- Notification system improvements (granular per-event control)
- Search UX improvements (better result ranking, release group filtering)
- Performance: reduce unnecessary re-renders, paginate heavy lists
- Accessibility: aria-labels on all interactive elements, semantic HTML throughout
- Visual polish: consistent spacing, cover art quality, status color clarity

---

## 6. Non-Goals (Explicit Out-of-Scope)

The following will not be built within this roadmap and are not planned:

| Out of scope                      | Reason                                                                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Game launcher / desktop agent** | Requires a persistent desktop process, OS-level integration, and significant platform-specific work. Out of scope for a server-side tool.             |
| **Game streaming server**         | Separate product class. Requires video encoding, session management, input streaming. Tools like Sunshine/Moonlight exist for this.                   |
| **Storefront replacement**        | Users still go to Steam/GOG to play games. Questarr facilitates acquisition and organization, not the storefront experience.                          |
| **Multi-user / multi-profile**    | Backend may support it architecturally, but UI, permission model, and per-user isolation are not planned. Single-user is the supported configuration. |
| **Cloud-hosted SaaS version**     | Self-hosted only. No plans for Questarr-as-a-service.                                                                                                 |

---

## 7. Success Measures

### Quality

- Keep release behavior and installation documentation aligned with shipped
  versions.
- Maintain contract tests for integrations and regression coverage for security-
  sensitive import and download paths.
- Publish supported architectures and release artifacts with their provenance
  information.

Community growth targets are not currently maintained in this product brief.

---

## 8. Technical Constraints & Principles

- **Supported deployments**: Features must work in Docker and the native Windows distribution; filesystem access must respect configured paths.
- **SQLite by default**: New features must not require PostgreSQL to function. Postgres is additive.
- **Single-user**: Single-user is the supported configuration. Preserve cookie authentication, CSRF protection, and authenticated real-time connections.
- **TypeScript strict**: No `any`, no untyped escape hatches introduced by new features.
- **SSRF protection**: All outbound HTTP calls (new integrations, debrid APIs) must go through `ssrf.ts` validation.
- **Backward compatibility**: Settings, config, and the database schema must migrate cleanly. No silent breaking changes.
- **Side-project pace**: Features are shipped when they're ready. No artificial deadlines.

---

## 9. Unscheduled proposals

The following ideas need product and implementation decisions before they are
scheduled. Their appearance here is not a commitment to ship them:

- Whether to support debrid/direct-download services, and which provider to
  support first.
- Whether to import owned Steam or GOG libraries, and which supported APIs or
  local data sources would be appropriate.
- Whether to add Gameyfin or user-defined webhook integrations.
