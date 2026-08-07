// tests/jwks-verifier.test.ts
//
// Exercises the production JWKS verifier end-to-end. A real RSA
// keypair is generated with `crypto.subtle.generateKey`, exported
// as JWK, and used both to sign tokens and to populate the JWKS
// document. EC P-256 is exercised the same way. The test
// fetcher is replaced with an in-memory function so the suite
// does not require network access.
//
// All key generation and signing goes through `crypto.subtle` —
// the same API surface the Worker runtime uses — so the verifier
// is exercised in the same way it will be in production.

import test from "node:test";
import assert from "node:assert/strict";
import { JwksVerifier, type Jwks } from "../packages/authentication/src";
import type { JwksVerifierOptions } from "../packages/authentication/src/jwks";

const enc = new TextEncoder();

// --- helpers -------------------------------------------------------------

interface RsaFixture {
  privateKey: CryptoKey;
  jwk: JsonWebKey;
}

async function generateRsa(): Promise<RsaFixture> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, jwk };
}

interface EcFixture {
  privateKey: CryptoKey;
  jwk: JsonWebKey;
}

async function generateEc(crv: "P-256" | "P-384" | "P-521" = "P-256"): Promise<EcFixture> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: crv }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { privateKey: pair.privateKey, jwk };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return Buffer.from(s, "binary").toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function jsonBase64Url(obj: unknown): string {
  return bytesToBase64Url(enc.encode(JSON.stringify(obj)));
}

interface SignArgs {
  privateKey: CryptoKey;
  alg: "RS256" | "ES256" | "ES384" | "ES512";
  kid: string;
  payload: Record<string, unknown>;
  headerExtras?: Record<string, unknown>;
}

async function signToken({ privateKey, alg, kid, payload, headerExtras }: SignArgs): Promise<string> {
  const header = { alg, kid, typ: "JWT", ...headerExtras };
  const headerB64 = jsonBase64Url(header);
  const payloadB64 = jsonBase64Url(payload);
  const signingInput = enc.encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign(
    alg === "RS256"
      ? { name: "RSASSA-PKCS1-v1_5" }
      : { name: "ECDSA", hash: alg === "ES256" ? "SHA-256" : alg === "ES384" ? "SHA-384" : "SHA-512" },
    privateKey,
    signingInput,
  );
  return `${headerB64}.${payloadB64}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

function makeFetcher(jwks: Jwks, failStatus?: number): typeof fetch {
  return (async (_input: RequestInfo | URL): Promise<Response> => {
    if (failStatus) {
      return new Response("nope", { status: failStatus });
    }
    return new Response(JSON.stringify(jwks), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

function makeVerifier(jwks: Jwks, options: Partial<JwksVerifierOptions> = {}): JwksVerifier {
  return new JwksVerifier({
    jwksUrl: "https://idp.example.test/.well-known/jwks.json",
    issuer: "https://idp.example.test/",
    audience: "keys-pluto",
    fetcher: makeFetcher(jwks),
    ...options,
  });
}

const ISS = "https://idp.example.test/";
const AUD = "keys-pluto";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function basePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: ISS,
    aud: AUD,
    sub: "user-1",
    iat: nowSec() - 5,
    exp: nowSec() + 60,
    ...overrides,
  };
}

// --- tests ---------------------------------------------------------------

test("JwksVerifier: RS256 happy path", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({ privateKey, alg: "RS256", kid: "k1", payload: basePayload() });
  const verifier = makeVerifier(jwks);
  const cred = await verifier.verify(token);
  assert.equal(cred.issuer, ISS);
  assert.equal(cred.audience, AUD);
  assert.equal(cred.subject, "user-1");
});

test("JwksVerifier: rejects a token signed by a different key", async () => {
  const a = await generateRsa();
  const b = await generateRsa();
  const jwks: Jwks = { keys: [{ ...a.jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({ privateKey: b.privateKey, alg: "RS256", kid: "k1", payload: basePayload() });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => {
    return (e as { code?: string }).code === "bad_signature";
  });
});

test("JwksVerifier: rejects an expired token", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({
    privateKey,
    alg: "RS256",
    kid: "k1",
    payload: basePayload({ iat: nowSec() - 3600, exp: nowSec() - 1800 }),
  });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "expired");
});

test("JwksVerifier: rejects a wrong issuer", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({
    privateKey,
    alg: "RS256",
    kid: "k1",
    payload: basePayload({ iss: "https://evil.example.test/" }),
  });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "wrong_issuer");
});

test("JwksVerifier: rejects a wrong audience", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({
    privateKey,
    alg: "RS256",
    kid: "k1",
    payload: basePayload({ aud: "some-other-app" }),
  });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "wrong_audience");
});

test("JwksVerifier: rejects an algorithm not in the allowlist", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  // The token claims HS256, which the verifier does not allow.
  const header = { alg: "HS256", kid: "k1", typ: "JWT" };
  const headerB64 = jsonBase64Url(header);
  const payloadB64 = jsonBase64Url(basePayload());
  const signingInput = enc.encode(`${headerB64}.${payloadB64}`);
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    enc.encode("k"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", hmacKey, signingInput);
  const token = `${headerB64}.${payloadB64}.${bytesToBase64Url(new Uint8Array(sig))}`;
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "alg_not_allowed");
});

test("JwksVerifier: rejects a token whose kid is unknown", async () => {
  const { privateKey } = await generateRsa();
  const jwks: Jwks = { keys: [] };
  const token = await signToken({ privateKey, alg: "RS256", kid: "missing", payload: basePayload() });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "unknown_kid");
});

test("JwksVerifier: caches the JWKS and only fetches once per TTL", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  let fetches = 0;
  const fetcher = (async () => {
    fetches++;
    return new Response(JSON.stringify(jwks), { status: 200 });
  }) as unknown as typeof fetch;
  const verifier = new JwksVerifier({
    jwksUrl: "https://idp.example.test/.well-known/jwks.json",
    issuer: ISS,
    audience: AUD,
    fetcher,
  });
  const token = await signToken({ privateKey, alg: "RS256", kid: "k1", payload: basePayload() });
  await verifier.verify(token);
  await verifier.verify(token);
  await verifier.verify(token);
  assert.equal(fetches, 1);
});

test("JwksVerifier: invalidateCache forces a refetch", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  let fetches = 0;
  const fetcher = (async () => {
    fetches++;
    return new Response(JSON.stringify(jwks), { status: 200 });
  }) as unknown as typeof fetch;
  const verifier = new JwksVerifier({
    jwksUrl: "https://idp.example.test/.well-known/jwks.json",
    issuer: ISS,
    audience: AUD,
    fetcher,
  });
  const token = await signToken({ privateKey, alg: "RS256", kid: "k1", payload: basePayload() });
  await verifier.verify(token);
  verifier.invalidateCache();
  await verifier.verify(token);
  assert.equal(fetches, 2);
});

test("JwksVerifier: jwks_unavailable when the endpoint fails", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({ privateKey, alg: "RS256", kid: "k1", payload: basePayload() });
  const verifier = makeVerifier(jwks, { fetcher: makeFetcher(jwks, 503) });
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "jwks_unavailable");
});

test("JwksVerifier: EC P-256 ES256 happy path", async () => {
  const { privateKey, jwk } = await generateEc("P-256");
  const jwks: Jwks = { keys: [{ ...jwk, kid: "ec1", alg: "ES256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({ privateKey, alg: "ES256", kid: "ec1", payload: basePayload() });
  const verifier = makeVerifier(jwks, { allowedAlgs: ["RS256", "ES256"] });
  const cred = await verifier.verify(token);
  assert.equal(cred.subject, "user-1");
});

test("JwksVerifier: rejects a malformed token", async () => {
  const { jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify("not.a.real.token.at.all"), (e: unknown) => (e as { code?: string }).code === "malformed_token");
  await assert.rejects(verifier.verify("only-one-segment"), (e: unknown) => (e as { code?: string }).code === "malformed_token");
});

test("JwksVerifier: rejects an unexpected typ", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({
    privateKey,
    alg: "RS256",
    kid: "k1",
    payload: basePayload(),
    headerExtras: { typ: "application/jose+json" },
  });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "bad_typ");
});

test("JwksVerifier: rejects an iat far in the future", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const token = await signToken({
    privateKey,
    alg: "RS256",
    kid: "k1",
    payload: basePayload({ iat: nowSec() + 600, exp: nowSec() + 1200 }),
  });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "iat_in_future");
});

test("JwksVerifier: rejects a token missing a subject", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  const payload = basePayload();
  delete (payload as Record<string, unknown>).sub;
  const token = await signToken({ privateKey, alg: "RS256", kid: "k1", payload });
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "missing_subject");
});

test("JwksVerifier: rejects when kid header is missing", async () => {
  const { privateKey, jwk } = await generateRsa();
  const jwks: Jwks = { keys: [{ ...jwk, kid: "k1", alg: "RS256", use: "sig" } as Jwks["keys"][number]] };
  // Sign without a kid in the header.
  const header = { alg: "RS256", typ: "JWT" };
  const headerB64 = jsonBase64Url(header);
  const payloadB64 = jsonBase64Url(basePayload());
  const signingInput = enc.encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, signingInput);
  const token = `${headerB64}.${payloadB64}.${bytesToBase64Url(new Uint8Array(sig))}`;
  const verifier = makeVerifier(jwks);
  await assert.rejects(verifier.verify(token), (e: unknown) => (e as { code?: string }).code === "missing_kid");
});
