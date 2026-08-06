# SysKey break-glass boundary

SysKey is a separately deployed Worker intended solely for emergency SysAdmin access. It is not a general identity provider, a copy of Keys, or a route around normal authorization. Separate deployment can protect against an application deployment/configuration failure; it cannot protect against a Cloudflare account, identity-provider, network, or shared data-store outage by itself.

The SysKey activation flow is **out of scope for the MVP** (see
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md)). The
checked-in SysKey Worker continues to expose only the
non-sensitive health endpoint; any actual access path requires the
backup break-glass administrator (Phase 4 issue 4.1), the
documented activation drill, and a production deployment of the
SysKey Worker, none of which exist yet.

Before SysKey can grant access, its access method must be independently configured and tested: a small pre-enrolled break-glass administrator set, phishing-resistant MFA, a separate signing/trust configuration, strict allow-listed tools, short-lived access, mandatory audit/alert delivery, and a documented activation/deactivation drill. If any verification dependency is unavailable, SysKey must deny rather than accept a caller-provided identity. The checked-in Worker currently provides only a non-sensitive health endpoint so it cannot accidentally become a bypass.
