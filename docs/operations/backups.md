# Backups and recovery

D1 contains control-plane records and needs a tested export/restore strategy before production use. R2 retention and versioning configuration also require explicit owner decisions. KV data is intentionally non-authoritative and must be reconstructable from D1 or configuration.

Required before production:

- named recovery owner and recovery approval authority;
- data classification, backup frequency, retention, residency, and encryption requirements;
- D1 export/restore and R2 recovery procedures expressed as versioned operator commands;
- a documented tenant-safe restore plan and a recorded restoration exercise;
- recovery objectives backed by evidence.

None of the above is complete in this scaffold. Never delete a remote resource as a substitute for recovery.
