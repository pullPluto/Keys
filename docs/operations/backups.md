# Backups and recovery

D1 contains control-plane records and needs a tested export/restore strategy before production use. R2 retention and versioning configuration also require explicit owner decisions. KV data is intentionally non-authoritative and must be reconstructable from D1 or configuration.

Required before production:

- named recovery owner and recovery approval authority;
- data classification, backup frequency, retention, residency, and encryption requirements;
- D1 export/restore and R2 recovery procedures expressed as versioned operator commands;
- a documented tenant-safe restore plan and a recorded restoration exercise;
- recovery objectives backed by evidence.

None of the above is complete in this scaffold. Never delete a remote resource as a substitute for recovery.

The recovery owner and restoration exercise are tracked as Phase 4
issues 4.2 (retention and classification) and 4.3d (incident response)
in [`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md), which
name the ADRs to be created (`ADR-013-retention-and-classification.md`
and an incident-response ADR) in the same PRs as the decisions. The
MVP's migration runner (Phase 0 issue 0.1) must record a recovery
note for the first applied migration before any D1 changes ship.
