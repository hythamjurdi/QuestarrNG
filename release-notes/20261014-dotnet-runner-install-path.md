---
category: fixed
audience: operators
area: ci
action: none
breaking: false
---

This records the former private-runner SDK installation path: Linux jobs installed the pinned .NET SDK in a writable temporary directory when the system-wide SDK directory was root-owned. The private runners were retired on 2026-10-16; current workflows use GitHub-hosted runners and no longer use this path.
