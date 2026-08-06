# Universal application registry

The application registry is the universal, versioned mechanism for adding company tools as they are discovered. It is not an unrestricted form: unsafe configuration must fail validation and every privileged change is reviewed and audited.

The application registry is **out of scope for the MVP** (see
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md)). The
MVP introduces the `applications` and `application_access_profiles`
tables so the data model is in place, but does not add the registry
routes, the protocol selection UI, or the high-risk-change approval
flow described below. Those land in a future phase that opens with
its own ADR, and they require the Phase 4 production gates to be
closed first.

## Application properties

Each application record supports: display name, owner, status, protocol(s), trusted redirect URIs, post-logout URIs, scopes, role/access-profile mapping, token/session policy override within approved bounds, provisioning mode, data classification, support contacts, criticality, rate limit, and migration notes. Secrets, private keys, and raw credentials are never application properties.

## Protocol roadmap

The registry has an extensible protocol field. The planned set is OIDC, OAuth client credentials, SAML, SCIM, proxy/header authentication, LDAP compatibility bridge, and service accounts. Each protocol is disabled by default, implemented only after it has a real target application and security test suite, and receives its own adapter. “Support all” does not mean every protocol is enabled for every application.

## Change controls

Creating an app, changing redirect URIs, enabling a protocol, adding a privileged scope, or changing a production access profile requires an authorized SysAdmin and audit record. High-risk changes require a second SysAdmin approval. Redirect URIs are exact, HTTPS-only production values; wildcards and arbitrary localhost exceptions are prohibited outside tightly controlled development configuration.

A future per-app **user field allow-list** (`allowed_user_fields`)
is being designed in
[issue M4.9 / ADR-015](../decisions/backlog/mvp.md#decision-adr-required-per-app-identity-mapping-for-cross-tool-user-references).
When that ADR lands, each application registration will declare
which `users` columns the application is approved to receive, and
any change to that allow-list is a privileged change that requires
a second SysAdmin approval under the same rule as the existing
high-risk-change list.
