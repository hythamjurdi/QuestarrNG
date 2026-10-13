---
category: fixed
audience: users, operators
area: unraid
action: none
breaking: false
---

The Unraid template now sets `UMASK=022` alongside its Unraid-compatible
`PUID=99` and `PGID=100` defaults, so files created by QuestarrNG use the
expected permissions.
