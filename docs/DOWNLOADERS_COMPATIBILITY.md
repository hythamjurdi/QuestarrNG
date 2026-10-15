# Compatibility

This document lists the current compatibility targets for downloaders supported by Questarr.

## Version info

| Downloader                | Version info                                                                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synology Download Station | Supports `SYNO.DownloadStation.Task` v1 and `SYNO.DownloadStation2.Task` v2 when exposed by the NAS.                                                      |
| Transmission              | Supports the classic Transmission RPC family over the session-based HTTP RPC endpoint.                                                                    |
| qBittorrent               | Supports qBittorrent WebUI API integrations, with modern support aligned to the 4.1+ API family.                                                          |
| rTorrent                  | Uses XML-RPC with SHA-256 Digest; MD5-only endpoints are rejected.                                                                                           |
| SABnzbd                   | Supports the current SABnzbd HTTP API, including the `addurl` and multipart `addfile` flows used by Questarr; modern releases such as 5.0.4 are in scope. |
| NZBGet                    | Supports the NZBGet RPC API used by Questarr, including `append`; the official API documentation covers NZBGet version 13.0 and later.                    |

## Plain HTTP connections

Questarr sends a downloader's password, API key, or Basic Auth header only
when the request URL is `https://`, or when the downloader has **Allow
insecure LAN** turned on. The check uses the URL the request actually goes
to, not just the **Use SSL** switch. Without the opt-in, a connection over
plain HTTP fails with a "refusing to send … over unencrypted HTTP" error.

Turn the opt-in on only for a downloader on a trusted network that cannot
use TLS. Upgrading from 1.4.x on SQLite turns it on once for existing HTTP
downloaders; new downloaders start with it off. See
[SECRETS.md](SECRETS.md) for the full credential policy.

## Priority and fallback

When several enabled downloaders are available, Questarr tries them in
priority order and falls back to the next client if an earlier add fails. A
lower number is tried first. The downloader priority control accepts values
from 1 through 100; you can clear the current value while typing a replacement.
A blank draft keeps the saved value, and the replacement is normalized when
you leave the field or press Enter.

## Details

### Synology Download Station

Questarr should work with both the legacy and modern Synology task APIs by querying `SYNO.API.Info` and using the best available task endpoint reported by the NAS.

The legacy API is documented in Synology's official Download Station API guide, while the newer `SYNO.DownloadStation2.Task` v2 API has been observed on DSM 7 era systems such as DSM 7.2.1 with Download Station 4.0.1.

### Transmission

Questarr uses the long-lived Transmission RPC interface rather than targeting one exact Transmission release. Transmission 4.1.0 introduced JSON-RPC 2.0 support and snake_case RPC strings, so newer protocol changes should be checked before making stricter version claims.

### qBittorrent

Questarr targets the qBittorrent WebUI API. Historical documentation exists for qBittorrent 3.2.0 through 4.0.4, while the maintained OpenAPI documentation covers the newer 4.1+ API family.

Older clients can ignore torrent tag filters or tags supplied when adding a
download. Questarr checks the tags reported on each torrent before associating
it with a request, and falls back to title matching when add tags are unsupported.

### rTorrent

QuestarrNG uses rTorrent's XML-RPC endpoint and accepts SHA-256 Digest only.
Classic MD5 and unsupported algorithms are rejected; upgrade rTorrent/ruTorrent
to a build that advertises SHA-256 Digest.

### SABnzbd

Questarr supports SABnzbd through its HTTP API, including `addurl` and multipart `addfile` flows; a live integration was verified on SABnzbd 5.1.3. For each download Questarr uses the request category when supplied, otherwise the saved downloader category, then `games`. Add any custom category to SABnzbd's category list as well: an unregistered category is reported in the queue as `*` (Default).

Questarr always verifies SABnzbd's TLS certificate, including for locally hosted
instances. It does not retry with certificate verification disabled. To use a
private or locally issued CA, add that CA to the operating system/container
trust store or set `NODE_EXTRA_CA_CERTS` to the CA PEM file before Questarr
starts, then restart the service. This keeps the SABnzbd API key and archive
password protected by authenticated TLS rather than accepting any certificate.

### NZBGet

Questarr supports NZBGet through its RPC API, including the `append` method used to add NZB files, archives, or URLs to the queue.

The official NZBGet API documentation states that it covers version 13.0 and later.
