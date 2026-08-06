// packages/authentication/src/index.ts
//
// Authentication contracts and the verifiers used in dev and
// production. The CredentialVerifier interface is the public
// surface. The dev HMAC verifier drives the MVP; the JWKS
// verifier (jwks.ts) is the M4.7 production verifier, gated on
// `ENVIRONMENT === "production"`.

import type { Identity, OrganizationId, IdentityId } from "../../identity/src";

import { JwksVerifier } from "./jwks";
export { JwksVerifier };
export type { JwksVerifierOptions, Jwks, JwksKey } from "./jwks";

export interface VerifiedCredential {
  issuer: string;
  audience: string;
  subject: string;
  expiresAt: Date;
}

export interface CredentialVerifier {
  /** Throws on invalid signature, wrong issuer/audience, expiry,
   *  or production-environment refusal. */
  verify(token: string): Promise<VerifiedCredential>;
}

export interface AuthenticatedPrincipal {
  identity: Identity;
  credential: VerifiedCredential;
}

/** Headers used to carry a dev credential. The format is:
 *  - Authorization: Bearer <token>
 *  where <token> is a JSON-encoded object containing iss, aud, sub, iat, exp
 *  and a `sig` field that's HMAC-SHA256(secret, payload) hex.
 *  The payload is everything except `sig`. */
export const DEV_AUTH_HEADER = "authorization";
export const DEV_BEARER_PREFIX = "Bearer ";

export class CredentialError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "CredentialError";
    this.code = code;
    this.status = status;
  }
}

export interface DevHmacVerifierOptions {
  /** The HMAC secret. In the MVP this is hard-coded in the dev
   *  configuration. The production verifier (M4.7 / #28) replaces
   *  this entirely. */
  secret: string;
  /** The expected issuer. */
  issuer: string;
  /** The expected audience. */
  audience: string;
  /** Tolerance for clock skew on `iat` and `exp`, in seconds. */
  clockSkewSeconds?: number;
  /** When true, the verifier refuses every call. Use this to make
   *  the dependency tree shake the verifier out of the production
   *  bundle. */
  refuse?: boolean;
}

/** Decode a hex string to a Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex string has odd length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const enc = new TextEncoder();

/** Constant-time comparison of two Uint8Arrays. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Sign a payload with HMAC-SHA256 using the given secret. */
async function hmacSha256(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return new Uint8Array(sig);
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export interface DevTokenPayload {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
}

/** Build a token to send to the dev verifier. Used by the test
 *  harness and by any future CLI. Production code must not use
 *  this; the production verifier is JWKS-based. */
export async function signDevToken(
  payload: DevTokenPayload,
  secret: string,
): Promise<string> {
  // The signed payload is everything except `sig`, in canonical key order.
  const signed = JSON.stringify({
    iss: payload.iss,
    aud: payload.aud,
    sub: payload.sub,
    iat: payload.iat,
    exp: payload.exp,
  });
  const sig = await hmacSha256(secret, signed);
  const tokenObject = { ...payload, sig: bytesToHex(sig) };
  return JSON.stringify(tokenObject);
}

export class DevHmacVerifier implements CredentialVerifier {
  private readonly secret: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly skew: number;
  private readonly refuse: boolean;
  constructor(options: DevHmacVerifierOptions) {
    this.secret = options.secret;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.skew = options.clockSkewSeconds ?? 30;
    this.refuse = options.refuse ?? false;
  }
  async verify(token: string): Promise<VerifiedCredential> {
    if (this.refuse) {
      throw new CredentialError(
        "dev_verifier_refused",
        403,
        "dev HMAC verifier is disabled in this environment",
      );
    }
    let payload: Record<string, unknown> & { sig?: string };
    try {
      payload = JSON.parse(token);
    } catch {
      throw new CredentialError("malformed_token", 401, "credential is not valid JSON");
    }
    const sig = payload.sig;
    if (typeof sig !== "string") {
      throw new CredentialError("missing_signature", 401, "credential is missing a signature");
    }
    // Reconstruct the signed payload (everything except `sig`) in
    // canonical order. The signer (signDevToken) and verifier must
    // agree on the key order and serialization.
    const signed = JSON.stringify({
      iss: payload.iss,
      aud: payload.aud,
      sub: payload.sub,
      iat: payload.iat,
      exp: payload.exp,
    });
    const expected = await hmacSha256(this.secret, signed);
    let provided: Uint8Array;
    try {
      provided = hexToBytes(sig);
    } catch {
      throw new CredentialError("malformed_signature", 401, "signature is not valid hex");
    }
    if (!timingSafeEqual(expected, provided)) {
      throw new CredentialError("bad_signature", 401, "signature does not match");
    }
    if (payload.iss !== this.issuer) {
      throw new CredentialError("wrong_issuer", 401, `issuer must be ${this.issuer}`);
    }
    if (payload.aud !== this.audience) {
      throw new CredentialError("wrong_audience", 401, `audience must be ${this.audience}`);
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.iat !== "number" || payload.iat > nowSec + this.skew) {
      throw new CredentialError("iat_in_future", 401, "iat is in the future beyond the clock-skew window");
    }
    if (typeof payload.exp !== "number" || payload.exp < nowSec - this.skew) {
      throw new CredentialError("expired", 401, "credential has expired");
    }
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new CredentialError("missing_subject", 401, "credential is missing a subject");
    }
    return {
      issuer: payload.iss,
      audience: payload.aud,
      subject: payload.sub,
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}

/** Construct the dev verifier from an Env. Reads
 *  `Env.MVP_HMAC_SECRET` and uses a fixed issuer/audience in dev.
 *  The `ENVIRONMENT` parameter is checked: production refuses. */
export function buildDevVerifier(env: {
  ENVIRONMENT: string;
  MVP_HMAC_SECRET?: string;
}): DevHmacVerifier {
  const refuse = env.ENVIRONMENT === "production";
  const secret = env.MVP_HMAC_SECRET ?? "dev-only-do-not-use-in-production";
  return new DevHmacVerifier({
    secret,
    issuer: "keys-pluto-dev",
    audience: "keys-pluto",
    refuse,
  });
}

/** Shape of the env fields the production verifier needs. The
 *  Worker env type extends this. */
export interface ProductionEnv {
  ENVIRONMENT: string;
  JWKS_URL?: string;
  PROD_ISSUER?: string;
  PROD_AUDIENCE?: string;
}

/** Build the credential verifier appropriate for the environment.
 *  In dev/staging this returns the dev HMAC verifier; in
 *  production it returns the JWKS verifier. The factory fails
 *  closed in production if any of the three required fields
 *  (JWKS_URL, PROD_ISSUER, PROD_AUDIENCE) are missing. */
export function buildVerifier(env: ProductionEnv): CredentialVerifier {
  if (env.ENVIRONMENT === "production") {
    if (!env.JWKS_URL || !env.PROD_ISSUER || !env.PROD_AUDIENCE) {
      throw new CredentialError(
        "jwks_not_configured",
        500,
        "production verifier is not configured (set JWKS_URL, PROD_ISSUER, PROD_AUDIENCE)",
      );
    }
    return new JwksVerifier({
      jwksUrl: env.JWKS_URL,
      issuer: env.PROD_ISSUER,
      audience: env.PROD_AUDIENCE,
    });
  }
  return buildDevVerifier(env);
}

/** Lookup a known identity from a verified subject. The MVP accepts
 *  any subject for which an `identities` row exists; production
 *  narrows the lookup once a real IdP is wired. */
export interface IdentityLookup {
  findByProviderSubject(
    subject: string,
    organizationId: OrganizationId,
  ): Promise<Identity | null>;
}

/** Resolve a verified credential to a full principal. The dev flow
 *  treats the credential's `sub` as `provider_subject`; the caller
 *  must know which tenant the subject belongs to. */
export async function resolvePrincipal(
  credential: VerifiedCredential,
  organizationId: OrganizationId,
  lookup: IdentityLookup,
): Promise<Identity> {
  const identity = await lookup.findByProviderSubject(credential.subject, organizationId);
  if (!identity) {
    throw new CredentialError(
      "unknown_subject",
      401,
      `no active identity for subject ${credential.subject} in this organization`,
    );
  }
  return identity;
}

/** Convenience: re-export the identity brand types so consumers can
 *  import them from a single package if they want. */
export type { Identity, OrganizationId, IdentityId };
