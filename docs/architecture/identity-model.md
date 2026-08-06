# Identity model

An **organization** is the primary tenant boundary. An **identity** is an organization-scoped linkage to a subject at an external provider. A **client** is a non-human caller with a credential reference, never a stored credential. An authenticated principal combines a verified credential with an enabled identity.

Every persisted identity key is unique within `(organization, provider, provider_subject)`. This prevents a subject from one provider being silently treated as the same principal as a matching string from another provider.

Attributes, groups, delegated administration, account recovery, and cross-organization access are not designed yet. Adding any one of these must include an ADR, data classification, revocation behavior, and migration plan.

A future **per-app identity mapping** layer is being designed in
[issue M4.9 (ADR-015)](../decisions/backlog/mvp.md#decision-adr-required-per-app-identity-mapping-for-cross-tool-user-references).
When that ADR lands, Keys will issue a stable internal `user_uuid`
per user and a **per-application opaque handle** (`app_user_id`)
that one PullPluto tool can hand to another without exposing the
internal UUID or letting the second tool reconstruct the first
tool's handle. The `chosen_name` that the layer exposes is **not**
a self-serve Keys field — it is delivered by the HR system (the
PullPluto HR adapter is a separate Phase 4 work item; see
[`docs/architecture/provisioning.md`](provisioning.md) and
replacement-program milestone 3) and is shared across every company
system. The `users` table today carries only the columns above plus
the internal row id used by the D1 schema; the `chosen_name`
column is part of the M4.9 implementation, not part of the MVP
schema.
