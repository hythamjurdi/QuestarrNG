# JSON download catalogs

Choose **JSON catalog (Hydra format)** when adding an indexer. Enter the public
HTTPS URL of a catalog you maintain or trust. No API key is used. Catalogs take
part in manual and scheduled searches alongside Torznab and Newznab sources;
normal title, platform, blacklist and download selection rules still apply.

The supported document shape is:

```json
{
  "name": "My catalog",
  "downloads": [
    {
      "title": "Example Game v1.2",
      "uris": ["https://example.com/example-game.torrent"],
      "uploadDate": "2026-10-12T00:00:00Z",
      "fileSize": "1.5 GiB"
    }
  ]
}
```

`title` and `uris` are required. Supported links are valid BitTorrent v1 magnets
and HTTPS URLs ending in `.torrent`. Direct installer downloads and file-hosting
pages are skipped. Date and size are optional; an unknown size is kept unknown.
Each result retains the configured source's name and ID.

Catalog fetches use the same DNS-pinned outbound transport as other integrations,
with public addresses and HTTPS required on every hop. Embedded URL credentials
are rejected. Responses are limited to 10 MiB and 50,000 releases, with a
15-second request timeout. Up to eight catalogs are cached for five minutes;
**Test Connection** refreshes the selected catalog immediately.

Catalogs do not provide authoritative indexer categories or payload file lists.
A curated source does not certify that a release is safe. Existing download and
import scanning controls still apply.
