# ADR-003: Defer LDAP compatibility from the initial platform

**Status:** Accepted for incubation
**Decision:** Keys exposes no LDAP server or LDAP-derived authorization model in its initial releases. A constrained LDAP compatibility bridge is planned only after a real application need, data-minimization design, and security review.

## Context and consequences

The platform needs modern application authentication and policy enforcement before it adds a directory protocol implementation. Deferral eliminates a substantial early protocol and operational surface. If a company tool requires LDAP interoperability, implement a narrowly scoped adapter under the universal application registry, with data minimization and lifecycle cost recorded in a follow-up ADR; do not place LDAP semantics in the core model by default.
