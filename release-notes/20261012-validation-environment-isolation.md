---
category: security
audience: operators
area: validation
action: none
breaking: false
---

Validation tasks and runtime probes now use restricted environments and private temporary settings, reducing exposure of unrelated credentials. Browser tests use a package-local Playwright cache, task scratch is removed after each run, and CI reuses its runner-local npm cache for locked dependencies.
