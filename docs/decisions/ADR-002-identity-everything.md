# ADR-002: Scope all protected records and actions to an organization

**Status:** Accepted for incubation
**Decision:** Organization is the primary tenant boundary; identities, clients, policies, audit events, and downstream requests carry organization scope.

## Context and consequences

Identity by itself does not prevent cross-customer access. Requiring organization scope in storage and decision interfaces makes tenant isolation visible and testable. It increases call-site discipline and does not solve cross-organization collaboration; such collaboration must be designed explicitly rather than represented by an unscoped user ID.
