# ADR-014: Production credential verifier (JWKS)

**Status:** Accepted for Phase 4
**Decision:** Replace the dev HMAC verifier with a JWKS-based verifier in production. The dev HMAC verifier remains in dev/staging; production refuses it by env gate.

## Context

The MVP authenticates every request with a `DevHmacVerifier` keyed on a single shared secret (`MVP_HMAC_SECRET`). This is fine for the MVP — a dev artifact never issued to humans — but is not an acceptable production authentication mechanism:

- A shared secret cannot be rotated atomically and cannot be scoped per-client.
- A shared secret cannot be safely handed to a production IdP, Mission Control, Armstrong, or any future Keys client.
- A shared secret creates a single high-value secret that the dev convenience was deliberately tolerating.

Production authentication is a JWT signed by an upstream identity provider. The public key is published at a JWKS endpoint; the verifier fetches and caches that document, finds the key by `kid`, verifies the signature, and validates the standard claims.

## Decision

The Worker uses two verifiers, selected by `Env.ENVIRONMENT`:

- `ENVIRONMENT ∈ { "development", "staging" }` → `DevHmacVerifier` (unchanged; the dev token format, secret, issuer, and audience are the MVP contract).
- `ENVIRONMENT === "production"` → `JwksVerifier`. The factory `buildVerifier(env)` returns this. The dev HMAC verifier refuses to operate in production by throwing `dev_verifier_refused` even if its constructor is reached.

### Contract for `JwksVerifier`

- **Algorithms:** `RS256` is allowed by default; the constructor accepts an `allowedAlgs` allowlist. `ES256`/`ES384`/`ES512` are supported. Symmetric algorithms (`HS*`) and `none` are never accepted.
- **Header:** `alg` must be in the allowlist; `kid` is required; `typ`, when present, must be `JWT` or `at+jwt`.
- **Key lookup:** JWK is selected by `kid` from the JWKS document. JWK `kty` is `RSA` (modulus `n`, exponent `e`) or `EC` (curve `crv`, coordinates `x`, `y`). Public keys are imported with `crypto.subtle.importKey("spki", ...)` using a hand-rolled DER encoding — no Node-only crypto APIs.
- **Claims:** `iss` must equal the configured issuer; `aud` must equal the configured audience; `iat` must be ≤ now + 30 s; `exp` must be ≥ now − 30 s; `sub` is required and is the identity's `provider_subject`.
- **JWKS cache:** 5 minutes, in-process. `invalidateCache()` forces a refetch. If a `kid` is not found, the cache is NOT invalidated by the verifier — production callers can opt to call `invalidateCache()` on a 401 and retry once to handle key rotation.

### Configuration

Production requires three new env fields, supplied as `wrangler secret put` (not `vars`):

- `JWKS_URL` — JWKS document URL, e.g. `https://idp.example.test/.well-known/jwks.json`.
- `PROD_ISSUER` — expected `iss` claim (e.g. `https://idp.example.test/`).
- `PROD_AUDIENCE` — expected `aud` claim (e.g. `keys-pluto`).

If any of the three is missing in production, `buildVerifier(env)` throws `CredentialError("jwks_not_configured", 500)` and the route layer surfaces a 500 — fail closed.

### Rotation

Key rotation is a property of the upstream IdP. Keys are added to the JWKS before the active period and removed after the grace period. The 5-minute cache bounds the maximum staleness of revocation. For faster rotation, production should call `invalidateCache()` on a `unknown_kid` response and retry once.

### Dependency choice

The JWS verification uses `crypto.subtle` (RSA / ECDSA). The DER encoding for SPKI is hand-rolled in `packages/authentication/src/jwks.ts`. No new npm dependency is added. This satisfies the Frameworks sufficiency ladder: platform features first.

## Consequences

- The dev HMAC verifier is a dev-only artifact. Any test, document, or CLI that uses `signDevToken` must be clearly labeled dev/staging.
- The `iss` and `aud` strings become a contract between the IdP and Keys. Changing them requires a coordinated deploy.
- Production is now bottlenecked on JWKS availability. A 5-minute cache + the `unknown_kid` retry path is the documented mitigation.
- The audit `metadata` does not include the JWT payload or the signing key. PII from the upstream IdP is not in scope for the allowlist.

## Related

- ADR-009 (MVP definition) — places the dev HMAC verifier in scope.
- Issue #28 (M4.7) — production credential verifier.
- Issue #26 (M3.1) — request envelope and the production gate.
- `packages/authentication/src/jwks.ts`, `packages/authentication/src/index.ts`.
- `tests/jwks-verifier.test.ts`.
