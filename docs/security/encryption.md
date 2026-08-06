# Encryption and secrets

Cloudflare-managed encryption at rest and transport encryption are platform controls, but the responsible owner must confirm contractual and residency requirements before production data is stored. The application must use HTTPS, avoid placing secrets in code/configuration, and use secret bindings for provider credentials.

If application-layer encryption is required, key ownership, rotation, envelope format, recovery, access policy, and failure behavior require an ADR. No custom cryptography is introduced by this scaffold.
