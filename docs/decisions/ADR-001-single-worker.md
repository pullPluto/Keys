# ADR-001: Start with one Worker delivery unit

**Status:** Accepted for incubation
**Decision:** Run the initial control-plane API as the `keys-pluto` Worker, with domain logic isolated in packages.

## Context

The first working behavior is limited to a health endpoint and small control-plane schema. Multiple deployed services would add deployment, policy, and observability surfaces before there is evidence that a split is needed.

## Consequences

This reduces initial operating overhead and keeps a single external enforcement boundary. It does not grant all modules permission to couple to each other. A split is required when independent scaling, blast-radius isolation, differing trust levels, a binding/runtime limit, or independently deployable provider adapters is evidenced. The split must retain the same authenticated and authorized boundary, with a new ADR and migration plan.
