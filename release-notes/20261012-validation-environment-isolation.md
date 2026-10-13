---
category: security
audience: operators
area: validation
action: none
breaking: false
---

Validation tasks and runtime probes now use restricted environments and private temporary settings, reducing exposure of unrelated credentials. Isolated tasks keep Playwright browsers available, disable inherited configuration, and remove task-owned temporary files. CI uses a reviewed npm runtime and locked dependencies.
