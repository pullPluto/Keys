# Identity model

An **organization** is the primary tenant boundary. An **identity** is an organization-scoped linkage to a subject at an external provider. A **client** is a non-human caller with a credential reference, never a stored credential. An authenticated principal combines a verified credential with an enabled identity.

Every persisted identity key is unique within `(organization, provider, provider_subject)`. This prevents a subject from one provider being silently treated as the same principal as a matching string from another provider.

Attributes, groups, delegated administration, account recovery, and cross-organization access are not designed yet. Adding any one of these must include an ADR, data classification, revocation behavior, and migration plan.
