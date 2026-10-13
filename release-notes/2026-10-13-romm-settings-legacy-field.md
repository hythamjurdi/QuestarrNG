---
category: fixed
audience: users
area: imports
action: none
breaking: false
---

RomM import settings can now be saved by older clients that still send the
fixed `multiFilePlacement: "subfolder"` field. The server ignores that legacy
default while continuing to reject unrelated unknown settings.
