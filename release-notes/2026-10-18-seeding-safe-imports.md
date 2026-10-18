---
category: changed
audience: users, operators
area: imports
action: Turn on "Auto-delete source after import" if you want configured moves to keep removing downloads.
breaking: true
---

Imports no longer delete original downloads unless "Auto-delete source after import" is on: a configured move runs as a copy while it is off, copy imports extract archives in place, and new RomM setups default to hardlinks.
