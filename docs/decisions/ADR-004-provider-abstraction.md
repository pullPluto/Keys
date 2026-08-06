# ADR-004: Keep AI and tool providers behind narrow adapters

**Status:** Accepted for incubation
**Decision:** AI model and MCP transport integrations implement narrow domain interfaces only after policy enforcement.

## Context and consequences

Provider APIs, credential models, data handling, and availability differ. A narrow adapter allows provider selection without allowing provider details to leak into identity or policy. It also means an adapter cannot bypass authorization, audit requirements, tenant routing, or budget decisions. No provider is selected by this decision; credentials and data-residency terms remain a human approval gate.
