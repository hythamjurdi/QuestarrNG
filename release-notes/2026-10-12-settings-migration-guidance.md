---
category: fixed
audience: users, operators
area: settings
action: Restart the service or container; source installs can run npm run db:migrate.
breaking: false
---

Settings errors now explain that database migrations run at startup, show the manual migration command only for source installs, and offer a Try again action after the service is available.
