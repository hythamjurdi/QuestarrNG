---
category: added
audience: operators
area: database-migration
action: none
breaking: false
---

Operators can copy a current PostgreSQL library into a migrated, empty SQLite database. Questarr keeps the source read-only and verifies all table contents inside one transaction; the older pre-v1.1 migration procedure remains separate.
