---
category: security
audience: operators
area: security
action: Check server logs when investigating production 5xx responses.
breaking: false
---

Production 5xx responses no longer include internal error details. The server keeps the original error in its logs so operators can diagnose failures.
