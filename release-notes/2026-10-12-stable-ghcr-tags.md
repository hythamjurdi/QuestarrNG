---
category: changed
audience: users, operators
area: container
action: Run docker compose pull and docker compose up -d to update an existing installation.
breaking: false
---

The default Compose file pulls the published GHCR image. Main builds use dev, while versioned releases update latest and keep an exact semantic-version tag for pinning.
