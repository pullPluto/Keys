// packages/authentication/src/jwks.ts
//
// Production credential verifier. Verifies a JWT against a JWKS
// (JSON Web Key Set) served by an upstream identity provider. The
// MVP is the only public consumer; the same verifier can be used
// by any Keys-protected application once the application registry
// lands.
//
// Token format: a compact JWS in the form
//   header.payload.signature
// where each part is base64url-encoded. The header carries the
// signing algorithm (alg), the key id (kid), and the type (typ).
// The payload is a JSON object with iss, aud, sub, iat, exp.
//
// The verifier:
//   1. Parses and validates the JWS structure.
//   2. Verifies the signature against the matching JWK from the
//      JWKS endpoint (cached in memory for 5 minutes).
//   3. Checks iss, aud, exp, iat with the same clock-skew window
//      as the dev HMAC verifier.
//   4. Returns a VerifiedCredential on success.

import { CredentialError, type VerifiedCredential } from "./index";

export interface JwksKey {
  kty: "RSA" | "EC";
  kid: string;
  alg?: string;
  use?: string;
  // RSA
  n?: string;
  e?: string;
  // EC
  crv?: string;
  x?: string;
  y?: string;
}

export interface Jwks {
  keys: JwksKey[];
}

export interface JwksVerifierOptions {
  /** URL of the JWKS document. */
  jwksUrl: string;
  /** Expected issuer. */
  issuer: string;
  /** Expected audience. */
  audience: string;
  /** Clock skew tolerance in seconds. */
  clockSkewSeconds?: number;
  /** Cache TTL in milliseconds. Default 5 minutes. */
  cacheTtlMs?: number;
  /** Optional fetcher override for tests. */
  fetcher?: typeof fetch;
  /** Algorithm allowlist. Default ["RS256"]. */
  allowedAlgs?: string[];
}

interface CacheEntry {
  jwks: Jwks;
  expiresAt: number;
}

/** Decode a base64url string to a Uint8Array. */
function base64UrlToBytes(s: string): Uint8Array {
  // base64url uses '-' and '_' instead of '+' and '/', and omits padding.
  let padded = s.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4 !== 0) padded += "=";
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const enc = new TextEncoder();

export class JwksVerifier {
  private cache: CacheEntry | null = null;
  private readonly jwksUrl: string;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly skew: number;
  private readonly cacheTtlMs: number;
  private readonly fetcher: typeof fetch;
  private readonly allowedAlgs: ReadonlySet<string>;
  constructor(options: JwksVerifierOptions) {
    this.jwksUrl = options.jwksUrl;
    this.issuer = options.issuer;
    this.audience = options.audience;
    this.skew = options.clockSkewSeconds ?? 30;
    this.cacheTtlMs = options.cacheTtlMs ?? 5 * 60 * 1000;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.allowedAlgs = new Set(options.allowedAlgs ?? ["RS256"]);
  }

  private async getJwks(): Promise<Jwks> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.jwks;
    }
    const res = await this.fetcher(this.jwksUrl);
    if (!res.ok) {
      throw new CredentialError(
        "jwks_unavailable",
        502,
        `JWKS fetch returned ${res.status}`,
      );
    }
    const jwks = (await res.json()) as Jwks;
    if (!Array.isArray(jwks.keys)) {
      throw new CredentialError("jwks_malformed", 502, "JWKS document is malformed");
    }
    this.cache = { jwks, expiresAt: Date.now() + this.cacheTtlMs };
    return jwks;
  }

  /** Force the next verify() to refetch the JWKS. */
  invalidateCache(): void {
    this.cache = null;
  }

  async verify(token: string): Promise<VerifiedCredential> {
    // 1. Structure: three base64url segments separated by '.'.
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new CredentialError("malformed_token", 401, "token is not a compact JWS");
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    let header: { alg?: string; kid?: string; typ?: string };
    try {
      header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64)));
    } catch {
      throw new CredentialError("malformed_token", 401, "header is not valid JSON");
    }
    if (!header.alg || !this.allowedAlgs.has(header.alg)) {
      throw new CredentialError("alg_not_allowed", 401, `algorithm ${header.alg ?? "(none)"} is not in the allowlist`);
    }
    if (!header.kid) {
      throw new CredentialError("missing_kid", 401, "header is missing kid");
    }
    if (header.typ && header.typ !== "JWT" && header.typ !== "at+jwt") {
      throw new CredentialError("bad_typ", 401, `unexpected typ ${header.typ}`);
    }

    // 2. Locate the JWK.
    const jwks = await this.getJwks();
    const key = jwks.keys.find((k) => k.kid === header.kid);
    if (!key) {
      throw new CredentialError("unknown_kid", 401, `no key with kid ${header.kid}`);
    }

    // 3. Verify signature.
    const signingInput = enc.encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlToBytes(signatureB64);
    let sigOk = false;
    if (key.kty === "RSA" && header.alg === "RS256" && key.n && key.e) {
      const cryptoKey = await importRsaPublicKey(key.n, key.e);
      sigOk = await crypto.subtle.verify(
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        cryptoKey,
        signature,
        signingInput,
      );
    } else if (key.kty === "EC" && key.crv && key.x && key.y) {
      const cryptoKey = await importEcPublicKey(key.crv, key.x, key.y);
      const hash = ecHashForAlg(header.alg);
      if (!hash) {
        throw new CredentialError("alg_not_allowed", 401, `unsupported EC alg ${header.alg}`);
      }
      sigOk = await crypto.subtle.verify(
        { name: "ECDSA", hash },
        cryptoKey,
        signature,
        signingInput,
      );
    } else {
      throw new CredentialError("unsupported_key", 401, "key type or algorithm is not supported");
    }
    if (!sigOk) {
      throw new CredentialError("bad_signature", 401, "signature does not verify");
    }

    // 4. Parse payload and check iss/aud/exp/iat.
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
    } catch {
      throw new CredentialError("malformed_token", 401, "payload is not valid JSON");
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
      issuer: String(payload.iss),
      audience: String(payload.aud),
      subject: String(payload.sub),
      expiresAt: new Date(payload.exp * 1000),
    };
  }
}

async function importRsaPublicKey(n: string, e: string): Promise<CryptoKey> {
  const mod = base64UrlToBytes(n);
  const exp = base64UrlToBytes(e);
  // SubjectPublicKeyInfo:
  //   SEQUENCE {
  //     AlgorithmIdentifier { rsaEncryption OID, NULL },
  //     BIT STRING { 00, RSAPublicKey { INTEGER modulus, INTEGER publicExponent } }
  //   }
  // rsaEncryption OID: 1.2.840.113549.1.1.1 -> 06 09 2a 86 48 86 f7 0d 01 01 01
  // AlgorithmIdentifier: 30 0d 06 09 ... 05 00 (NULL params)
  const algId = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);
  // RSAPublicKey SEQUENCE { modulus, publicExponent }, each as INTEGER.
  // An INTEGER whose high bit is set must be prefixed with 0x00 to keep it positive.
  const modInt = wrapDer(0x02, mod[0] & 0x80 ? concat(new Uint8Array([0x00]), mod) : mod);
  const expInt = wrapDer(0x02, exp[0] & 0x80 ? concat(new Uint8Array([0x00]), exp) : exp);
  const rsaPubKey = wrapDer(0x30, concat(modInt, expInt));
  // BIT STRING: tag 0x03, then the contents, prefixed with 0x00 (number of unused bits).
  const bitString = wrapDer(0x03, concat(new Uint8Array([0x00]), rsaPubKey));
  const spki = wrapDer(0x30, concat(algId, bitString));
  return crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function importEcPublicKey(crv: string, x: string, y: string): Promise<CryptoKey> {
  const alg = crvToSubtleAlg(crv);
  if (!alg) throw new Error(`unsupported EC curve ${crv}`);
  const xBytes = base64UrlToBytes(x);
  const yBytes = base64UrlToBytes(y);
  // uncompressed point: 0x04 || X || Y
  const point = concat(new Uint8Array([0x04]), xBytes, yBytes);
  // SubjectPublicKeyInfo for id-ecPublicKey + named curve.
  // Per RFC 5480 the AlgorithmIdentifier is a SEQUENCE of
  // { id-ecPublicKey, namedCurve }.
  const curveOid = curveOidBytes(crv);
  const algId = wrapDer(
    0x30,
    concat(
      new Uint8Array([0x06, EC_PUBLIC_KEY_OID.length]),
      EC_PUBLIC_KEY_OID,
      new Uint8Array([0x06, curveOid.length]),
      curveOid,
    ),
  );
  const keyBitString = wrapDer(0x03, concat(new Uint8Array([0x00]), point));
  const spki = wrapDer(0x30, concat(algId, keyBitString));
  return crypto.subtle.importKey(
    "spki",
    spki,
    { name: "ECDSA", namedCurve: alg },
    false,
    ["verify"],
  );
}

function crvToSubtleAlg(crv: string): string | null {
  switch (crv) {
    case "P-256": return "P-256";
    case "P-384": return "P-384";
    case "P-521": return "P-521";
    default: return null;
  }
}

function ecHashForAlg(alg: string): string | null {
  switch (alg) {
    case "ES256": return "SHA-256";
    case "ES384": return "SHA-384";
    case "ES512": return "SHA-512";
    default: return null;
  }
}

/** OID bytes (DER content) for common EC curves. */
function curveOidBytes(crv: string): Uint8Array {
  switch (crv) {
    case "P-256": return new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
    case "P-384": return new Uint8Array([0x2b, 0x81, 0x04, 0x00, 0x22]);
    case "P-521": return new Uint8Array([0x2b, 0x81, 0x04, 0x00, 0x23]);
    default: throw new Error(`unknown curve ${crv}`);
  }
}

/** id-ecPublicKey OID (1.2.840.10045.2.1). */
const EC_PUBLIC_KEY_OID = new Uint8Array([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]);

function wrapDer(tag: number, content: Uint8Array): Uint8Array {
  // DER: tag | length-of-length-bytes | length-bytes | content
  let len = content.length;
  let lenBytes: number[];
  if (len < 0x80) {
    lenBytes = [len];
  } else {
    const stack: number[] = [];
    while (len > 0) {
      stack.unshift(len & 0xff);
      len >>= 8;
    }
    lenBytes = [0x80 | stack.length, ...stack];
  }
  return concat(new Uint8Array([tag, ...lenBytes]), content);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}
