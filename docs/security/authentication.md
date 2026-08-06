# Authentication requirements

Only verified, time-bounded credentials from explicitly configured issuers and audiences may create a principal. Verification must validate signature, issuer, audience, expiry, and relevant anti-replay properties for the selected protocol. Resolve the external subject to an active organization-scoped identity after verification.

The concrete identity provider and protocol support are **TBD**. No endpoint currently authenticates callers. Never implement token parsing without cryptographic verification, accept arbitrary issuers, or treat a client-provided tenant identifier as authoritative.

The MVP (see [`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md))
ships a dev/staging-only HMAC verifier (Phase 1 issue 1.5) and
rejects it at the Worker boundary when
`ENVIRONMENT === "production"`. The production verifier is a
separate Phase 4 issue (4.4) and must land before any production
deployment. The MVP does not change this requirement: dev
verifiers are not "good enough" for production, and the
enforcement that says so is a deliverable, not a TODO.
