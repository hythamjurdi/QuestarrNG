# QuestarrNG — Product Requirements Document

- **Version:** 1.2
- **Last reviewed:** 2026-10-16
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

## 4. Current shipped capabilities (QuestarrNG 2.1.1)

QuestarrNG 2.1.1 is the latest stable release reviewed for this brief. The
release history and full change list are in [FORK_CHANGES.md](FORK_CHANGES.md)
and [CHANGELOG.md](CHANGELOG.md).

### Library and discovery

- Add games manually or discover them through IGDB and optional RAWG; follow
  RSS and xREL feeds; sync a Steam wishlist; or scan configured local platform
  roots. Platform, genre, year, and content filters narrow discovery results.
- Track Wanted, Owned, Playing, Completed, and Shelved games, ratings, and
  notes. Sort and filter the library, keep private game lists, use release
  calendars, and pick a game with Backlog roulette. Platform preferences scope
  discovery, library views, game adds, download searches, and import eligibility.
- Record Playing journal entries, milestones, screenshots, and Steam
  achievements. Game details include DLC/expansions, crack status, HowLongToBeat
  estimates for close title matches, PCGamingWiki, and NexusMods trends.
- Track installed versions from completed downloads or game details, see
  available update indicators, and keep selected platform release dates in
  discovery and the SeerrNG catalog.

### Search, downloads, and imports

- Search Torznab, Newznab, G4U, Prowlarr-synced indexers, and public HTTPS
  Hydra-format catalogs. Manual and scheduled searches support auto-download,
  release blacklists, verified torrent file-type filters, saved scoring
  profiles, preferred groups/platforms, and source-page links.
- Send results to configured download clients or download `.torrent` and
  `.nzb` files directly. Choose which updates and small extras to include with
  a main release; scheduled searches honor selected DLC/extra categories, and
  game files can keep their own category and installed version.
- Monitor qBittorrent, Transmission, rTorrent, Deluge, Synology Download
  Station, SABnzbd, and NZBGet. Real-Debrid supports OAuth device authorization
  and local staging before the regular import pipeline.
- Move, copy, hardlink, or symlink completed downloads; unpack archives; and
  route matched ROM imports to RomM. Optional VirusTotal and ClamAV checks can
  quarantine flagged files. Archive, path, ownership, and scan limits protect
  the import boundary. Import history, manual review, and recovery cover failed,
  interrupted, and orphaned downloads.
- Optional experimental release analysis uses TypeSafe/Jev through OpenRouter
  with the user's own API key.

### Integrations and interface

- The Playnite extension can synchronize a library, promote installed games to
  owned, and submit requests to Questarr's search/download workflow.
- The versioned SeerrNG provider carries the external request ID and selected
  PC variant through acquisition, supports retry/cancel and request status, and
  streams imported files through authenticated request-scoped routes. It
  supports both single files and multi-file bundles.
- The interface is available in English and twelve translated locales with
  browser-local language selection, regional date and number formats, and
  right-to-left layout support.
- In-app and Apprise notifications have independent preferences. The interface
  also includes collection/download statistics, optional Discord sharing,
  settings, and system logs.

### Operations and releases

- JWT-authenticated REST and Socket.IO APIs support the browser and documented
  integrations.
- SQLite is the default database; PostgreSQL is optional. Documented migration
  paths cover SQLite-to-PostgreSQL and PostgreSQL-to-SQLite copies.
- Deploy with multi-architecture `linux/amd64` and `linux/arm64` images, the
  self-contained .NET 10 Windows service installer, Helm, or supported
  home-server app definitions.
- Version-tag releases publish the GHCR image and versioned release assets,
  including the Windows x64 installer and Helm chart with checksums. Production
  image publication runs through release security and smoke-check gates.
- Rootless deployment options, SSRF and filesystem boundary checks, and
  published SBOM/provenance attestations support hardened operation.

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

### P1 — Smart game backlog (version-aware updates) _(partly shipped)_

**Shipped:** Completed downloads record installed versions, older update
releases are not suggested, and library cards distinguish available updates
from ordinary search results.

**Remaining:**

- Parse release versions reliably across supported release naming patterns.
- Compare new scheduled-search results with the stored installed version.
- Notify only when a strictly higher version is available (e.g. v1.0 → v1.1).
- Offer an opt-in to automatically download upgrades.

**Why:** Moves Questarr from "download once" to "keep library current" — the full \*Arr experience.

---

### P2 — Direct search-result and debrid downloads (Real-Debrid shipped; other providers proposed)

**Status:** QuestarrNG can download `.torrent` and `.nzb` files directly from
search results or send a release to a configured client. It also includes a
first-class Real-Debrid downloader. Users link their account through device
authorization, submit magnets or torrent files, and stage completed files
locally for the normal post-processing and import flow. Real-Debrid shipped in
QuestarrNG 1.10.0; direct search-result downloads shipped in 2.0.0. Support for
AllDebrid and similar services remains a separate proposal.

**Problem:** Some users prefer direct download services (Real-Debrid, AllDebrid, etc.) over traditional torrent/usenet pipelines — no seeding required.

**Delivered Real-Debrid behavior:**

- First-class Real-Debrid downloader type in the existing downloader UI
- OAuth device authorization instead of manually pasting a private API token
- Magnet and torrent-file acquisition, tracked through cloud completion
- Local staging followed by QuestarrNG's existing post-processing/import path

**Future scope:** Evaluate additional direct-download providers separately; do
not imply that Real-Debrid support automatically covers other services.

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

- Keep SQLite as the default and PostgreSQL as an optional backend.
- Maintain the Drizzle schema across both database dialects.
- Provide a documented SQLite-to-PostgreSQL migration path.
- Provide a verified PostgreSQL-to-empty-SQLite copy migration for operators
  who want to move back to the default database.

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

- Whether and how to expand direct-download support beyond Real-Debrid.
- Whether to import owned Steam or GOG libraries, and which supported APIs or
  local data sources would be appropriate.
- Whether to add Gameyfin or user-defined webhook integrations.
