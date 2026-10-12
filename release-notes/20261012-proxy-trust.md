---
category: security
audience: operators
area: networking
action: Set TRUST_PROXY to your trusted proxy hop count or addresses when deploying behind a reverse proxy.
breaking: true
---

Forwarded client addresses and protocol headers are trusted only when TRUST_PROXY is configured, preventing direct clients from bypassing login rate limits with forged proxy headers.
