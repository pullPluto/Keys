# Authentication requirements

Only verified, time-bounded credentials from explicitly configured issuers and audiences may create a principal. Verification must validate signature, issuer, audience, expiry, and relevant anti-replay properties for the selected protocol. Resolve the external subject to an active organization-scoped identity after verification.

The concrete identity provider and protocol support are **TBD**. No endpoint currently authenticates callers. Never implement token parsing without cryptographic verification, accept arbitrary issuers, or treat a client-provided tenant identifier as authoritative.
