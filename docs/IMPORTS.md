# Download processing, RomM, and security scans

QuestarrNG can process completed downloads automatically or present them for
review before they enter a library. Open **Settings → Import** to configure the
pipeline. Its tabs cover **General Config**, **RomM**, **Path Mappings**, and
**Security & Scanning**.

For root-folder discovery, import history, and download recovery, see the
[Library Import guide](LIBRARY_IMPORT.md).

## Set up post-processing

1. In **General Config**, enable **Post-Processing** and choose the library
   root as QuestarrNG sees it (for example, `/data/games`).
2. Configure how files should be transferred and whether archives should be
   unpacked. You can also choose the rename pattern, platform eligibility,
   whether to sort detected DLC/updates/extras into subfolders, and whether to
   delete the source after a successful import.
3. If a downloader uses a different host path from QuestarrNG, configure a
   **Path Mapping** so the server can resolve the completed download. The
   download and destination roots must be available to the QuestarrNG process.
4. Use the built-in hardlink check before selecting hardlinks. Hardlinks require
   compatible paths on the same filesystem; use copy or move when the source
   and library are on separate volumes.

### Keep downloads seeding

QuestarrNG never deletes an original download unless **Auto-delete source
after import** is on (it is off by default). This applies to PC and RomM
imports alike:

- **Hardlink**, **Copy**, and **Symlink** leave the download where the client
  put it. Archives are read in place and extracted into the destination; no
  raw archive copy is written into the library.
- **Move** removes the download, so it only runs as a move when auto-delete is
  on. While auto-delete is off, a configured move is performed as a copy and
  the settings page shows a warning. A mode picked for a single import in the
  review dialog is used as chosen.
- With auto-delete on, a successful import removes the download from the
  client together with its files. Hardlinked imports qualify (the library copy
  keeps its data); symlinked imports never do, because they point at the
  download.

### Extraction temp directory

Archives are unpacked into a staging folder first and merged into the
destination afterwards, so a failed extraction never leaves half a game in the
library. By default the staging folder is a hidden `.questarr-extract-*`
directory inside the destination. To use a different disk (for example, a fast
cache drive), set **Extraction temp directory** in **General Config**.
QuestarrNG checks that the directory is writable when you save it, checks free
space against the archive's declared size before extracting, and always
deletes its per-run folder afterwards, whether the import succeeded or not.

For archive safety, QuestarrNG validates paths and links before extraction and
limits the default archive to 50,000 entries and 250 GiB of declared expanded
data. Set `ARCHIVE_MAX_ENTRIES` or `ARCHIVE_MAX_EXPANDED_BYTES` in the server
environment to change these limits. Each archive tool invocation has a
30-minute timeout. These checks do not replace filesystem quotas.

Downloads that need a destination choice, archive password, or other review
appear in the **Pending Imports** card on the Library page. Use **Review** to
inspect the proposed source and destination before confirming the import.

## Route ROM imports to RomM

QuestarrNG writes files into RomM's mounted library folders and, when
configured, asks RomM to scan the platforms it just added files to. Mount the
same storage into both services and make sure the QuestarrNG process can read
and write it.

1. Open **Settings → Import → RomM** and enable **Route ROM imports to RomM**.
2. Set **RomM ROM library root** to the folder that holds your platform
   folders, as the path inside QuestarrNG's container or host process.
3. Choose the **Folder layout** that matches your RomM library. The settings
   page shows where a PS2 game would land.

   | Layout                                    | RomM library looks like | Set the library root to |
   | ----------------------------------------- | ----------------------- | ----------------------- |
   | **Library root → platform → game**        | `roms/ps2/Game.iso`     | the `roms` folder       |
   | **Library root → platform → roms → game** | `ps2/roms/Game.iso`     | the folder above `ps2`  |

4. Choose how platform folders are named:
   - **RomM platform slug** uses the RomM slug with the layout above.
   - **Custom folder bindings** maps RomM slugs to relative folders under the
     library root using the JSON editor. A binding names the exact folder and
     ignores the layout; platforms without one use the layout, or go to review
     when **Unmapped platform behavior** is **Require a custom binding**.
5. In **Platform slug mappings**, assign a RomM slug to each IGDB platform.
   The slug must match the platform's folder name in your RomM library exactly.
   Use **Load default platform mappings** when the list is empty, **Add
   platform** for anything not listed, and **Add any missing default
   platforms** to pick up defaults added in newer versions without changing
   your existing mappings. A blank slug leaves that platform's imports in the
   PC library. When a release name carries a platform tag (for example
   `PS5-DUPLEX`), that tag decides the platform; otherwise the game's first
   IGDB platform is used.
6. Choose the transfer mode (the default is **Hardlink**, which falls back to
   a copy across filesystems) and how to handle an existing game. You can keep
   both files with a new name, skip, replace, or send the conflict for review.
   Single-file ROMs can go directly in the platform folder or in a game folder.
7. Under **Archives and extra files**, choose what gets unpacked and which file
   types are skipped (see below).
8. Fill in **RomM scanning** (see below) so new games appear in RomM without
   a manual scan.
9. Save the settings. For a manual import, choose **RomM ROM library** in the
   review dialog when the option is available.

Folder bindings are relative to the configured RomM library root, so they
cannot select an arbitrary destination.

### Archives and extra files

RomM imports use their own unpack switches; the general **Auto-Unpack
Archives** switch does not affect them.

| Switch                  | Default | Notes                                                                                           |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| **Unpack RAR archives** | On      | Includes multi-volume sets: `Game.part1.rar`, `Game.part2.rar`, … or `Game.rar`, `Game.r00`, …. |
| **Unpack 7z archives**  | Off     | Leave off if your RomM platforms store games as `.7z`.                                          |
| **Unpack zip archives** | Off     | Leave off for cartridge systems; RomM reads and hashes zipped ROMs directly.                    |

Archive types that are switched off are copied as they are. For the types that
are on:

- Multi-volume sets are extracted from their first volume.
- A release with several independent sets (for example, one per disc) has
  every set extracted into the same game folder.
- Extraction reads the volumes in place and goes through the staging folder,
  so the download keeps seeding.

**Skip these file types** lists extensions that are never copied into RomM,
whether they sit next to the game in the download or come out of an archive.
The default is `.nfo, .sfv, .diz, .url, .md5, .sha1, .txt`. Skipped files stay
in the download; leave the list empty to copy everything.

### Scan RomM after an import

1. In RomM, create a **Client API Token** with the `tasks.run` scope. On RomM
   versions that predate the scan API, also grant `platforms.read`.
2. In **RomM scanning**, enter the **RomM URL** as QuestarrNG can reach it
   (for example, `http://romm:8080`) and the token, then use **Test
   connection**. The token is never sent back to the browser after saving.
3. Choose the **Scan type**. **Quick** picks up new files only and is the
   right choice for imports.
4. Choose **What to scan**: only the platforms that received new games (the
   default), or the whole RomM library.
5. Set the **Scan delay**. Imports that finish within this window are sent as
   one scan covering every platform they touched (default 30 seconds).

QuestarrNG calls `POST /api/tasks/scan` with the RomM platform slugs of the
imported games. If a scan is already running, it retries after 1, 2, 5, and
10 minutes. RomM versions without that endpoint are scanned through RomM's
websocket `scan` event instead, which needs `platforms.read` to resolve
platform IDs. A failed scan request never fails the import: the files are
already in place, and QuestarrNG records a warning notification. **Scan RomM
now** starts a scan on demand: every mapped platform, or the whole library
when that scope is selected.

## Configure pre-import security scans

Both scanners are optional and disabled until configured. Open **Settings →
Import → Security & Scanning**. Save the settings before using **Test**; the
buttons test the saved configuration.

| Scanner        | What QuestarrNG sends                                                                                                                             | Configuration and behavior                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VirusTotal** | A SHA-256 hash over HTTPS. The file itself is not uploaded. For a directory download, QuestarrNG checks the largest file as the primary artifact. | Enter an API key and set the detection threshold. An import is blocked when the number of malicious detections is greater than the threshold. Unknown hashes are allowed by default; enable **Block Unknown Hashes** to block them. |
| **ClamAV**     | File contents streamed to the configured ClamAV daemon over its INSTREAM TCP protocol.                                                            | Enter the daemon host and port (default `3310`). ClamAV examines up to 10,000 files in a directory download. A partial or incomplete directory scan blocks the import.                                                              |

The VirusTotal API key is stored in QuestarrNG's database without encryption;
protect the database and its backups. ClamAV's INSTREAM connection is not
encrypted, so keep the daemon on a trusted network. See
[`SECRETS.md`](SECRETS.md) and [`THREAT_MODEL.md`](THREAT_MODEL.md) for the
security details.

Scanner network or timeout errors do not block an import. VirusTotal results
that are unknown or below the configured threshold also continue unless
**Block Unknown Hashes** applies. An incomplete ClamAV file listing is treated
as a block so QuestarrNG does not report a partial scan as clean. These checks
are optional defense in depth, not a guarantee that every file is safe.

## When a download is flagged

QuestarrNG moves a flagged download into a `.questarr-quarantine` directory
beside the selected library root, records its `quarantined` status, and creates
an in-app **Security Alert** when that notification is enabled. The item
appears in the Library page's **Pending Imports** card with the scanner reason.
A quarantined item has no **Review**
action, and the import endpoint rejects it even if a client tries to submit an
import plan directly.

The parent of the library root must be writable by QuestarrNG so it can create
the sibling quarantine directory. If `/data` is itself a read-only or
root-owned mount point, set the library root to a subdirectory such as
`/data/games` so quarantine can be created alongside it inside the writable
volume.

**Dismiss** clears the item from Pending Imports; it does not import, restore,
or delete the quarantined file, and it does not dismiss the separate
notification. Inspect or remove the file through the host filesystem according
to your own review process.

For a summary of all capabilities added by the fork, see
[`FORK_CHANGES.md`](FORK_CHANGES.md). For the complete version history, see
[`CHANGELOG.md`](CHANGELOG.md).
