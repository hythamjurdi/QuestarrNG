---
category: changed
audience: operators
area: release-pipeline
action: none
breaking: false
---

QuestarrNG CI now records source-bound receipts for the full test suite and both Node build runners. Final CI reconciliation requires all three results to come from the same workflow attempt, source snapshot, and test inventory.
