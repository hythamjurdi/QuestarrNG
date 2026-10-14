---
category: fixed
audience: users
area: downloads
action: none
breaking: false
---

When qBittorrent accepts a download but its status lookup is unavailable, Questarr now returns promptly and keeps tracking the add by its correlation tag. If lookups succeed but no matching torrent appears, Questarr continues polling only within the existing 15-second limit and never resubmits an accepted add as a torrent-file upload.
