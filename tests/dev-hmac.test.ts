// tests/dev-hmac.test.ts
//
// Tests for the M1.4 dev HMAC verifier. The verifier is the only
// authentication path in the MVP and must be exercised at the
// unit level independent of the route layer.

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDevVerifier,
  CredentialError,
  DevHmacVerifier,
  signDevToken,
} from "../packages/authentication/src";

const nowSec = () => Math.floor(Date.now() / 1000);
const basePayload = () => ({
  iss: "keys-pluto-dev",
  aud: "keys-pluto",
  sub: "alice",
  iat: nowSec(),
  exp: nowSec() + 60,
});

test("dev HMAC: signs and verifies a valid token", async () => {
  const secret = "test-secret";
  const token = await signDevToken(basePayload(), secret);
  const verifier = new DevHmacVerifier({
    secret,
    issuer: "keys-pluto-dev",
    audience: "keys-pluto",
  });
  const credential = await verifier.verify(token);
  assert.equal(credential.subject, "alice");
  assert.equal(credential.issuer, "keys-pluto-dev");
  assert.equal(credential.audience, "keys-pluto");
});

test("dev HMAC: rejects a tampered signature", async () => {
  const token = await signDevToken(basePayload(), "test-secret");
  const verifier = new DevHmacVerifier({
    secret: "different-secret",
    issuer: "keys-pluto-dev",
    audience: "keys-pluto",
  });
  await assert.rejects(verifier.verify(token), (e: unknown) => {
    return e instanceof CredentialError && e.code === "bad_signature";
  });
});

test("dev HMAC: rejects a token with the wrong issuer", async () => {
  const token = await signDevToken({ ...basePayload(), iss: "evil" }, "test-secret");
  const verifier = new DevHmacVerifier({
    secret: "test-secret",
    issuer: "keys-pluto-dev",
    audience: "keys-pluto",
  });
  await assert.rejects(verifier.verify(token), (e: unknown) => {
    return e instanceof CredentialError && e.code === "wrong_issuer";
  });
});

test("dev HMAC: rejects a token with the wrong audience", async () => {
  const token = await signDevToken({ ...basePayload(), aud: "evil" }, "test-secret");
  const verifier = new DevHmacVerifier({
    secret: "test-secret",
    issuer: "keys-pluto-dev",
    audience: "keys-pluto",
  });
  await assert.rejects(verifier.verify(token), (e: unknown) => {
    return e instanceof CredentialError && e.code === "wrong_audience";
  });
});

test("dev HMAC: rejects an expired token", async () => {
  // Keep iat within the skew window (skew defaults to 30s) but set
  // exp far enough in the past to fail the exp check.
  const token = await signDevToken(
    { ...basePayload(), iat: nowSec() - 60, exp: nowSec() - 60 },
    "test-secret",
  );
  const verifier = new DevHmacVerifier({
    secret: "test-secret",
    issuer: "keys-pluto-dev",
    audience: "keys-pluto",
  });
  await assert.rejects(verifier.verify(token), (e: unknown) => {
    return e instanceof CredentialError && e.code === "expired";
  });
});

test("dev HMAC: rejects malformed JSON", async () => {
  const verifier = new DevHmacVerifier({
    secret: "test-secret",
    issuer: "keys-pluto-dev",
    audience: "keys-pluto",
  });
  await assert.rejects(verifier.verify("not json"), (e: unknown) => {
    return e instanceof CredentialError && e.code === "malformed_token";
  });
});

test("dev HMAC: buildDevVerifier refuses in production", async () => {
  const verifier = buildDevVerifier({ ENVIRONMENT: "production" });
  await assert.rejects(
    verifier.verify(
      JSON.stringify({ iss: "x", aud: "x", sub: "x", iat: 0, exp: 0, sig: "00" }),
    ),
    (e: unknown) => e instanceof CredentialError && e.code === "dev_verifier_refused",
  );
});

test("dev HMAC: buildDevVerifier allows in dev", async () => {
  const verifier = buildDevVerifier({ ENVIRONMENT: "development", MVP_HMAC_SECRET: "s" });
  // A non-refusing dev verifier with a bogus token rejects on
  // signature, not on the refuse flag.
  await assert.rejects(
    verifier.verify(JSON.stringify({ iss: "x", aud: "x", sub: "x", iat: 0, exp: 0, sig: "00" })),
    (e: unknown) => e instanceof CredentialError && e.code !== "dev_verifier_refused",
  );
});
