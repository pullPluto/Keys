# ADR-006: Use a universal application registry with protocol adapters

**Status:** Accepted for incubation
**Decision:** New company tools are registered through one versioned application model with protocol-specific adapters and approved configuration properties.

## Consequences

This gives PullPluto one visible integration inventory without making every app share insecure defaults. It requires strict schema/redirect-URI validation, ownership, change approval, and audit before activation. Protocols are enabled only where needed and tested.
