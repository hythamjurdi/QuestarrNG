---
category: fixed
audience: operators
area: deployment
action: none
breaking: false
---

Docker Compose once again accepts `PORT` from the project `.env` file as a
fallback for both the host and container HTTP ports. Set `HOST_SIDE_PORT` or
`CONTAINER_INTERNAL_SIDE_PORT` to override either side independently.
