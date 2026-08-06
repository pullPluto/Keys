import assert from "node:assert/strict";
import test from "node:test";

import {
  SchemaError,
  errorResponse,
  isProduction,
  isValidOrgSlug,
  jsonResponse,
  newCorrelationId,
  parseJsonRequest,
  productionGate,
  readOrCreateCorrelationId,
} from "../apps/worker/src/http/envelope";

// Helper: build a Request with an optional body and headers.
const buildRequest = (
  body: BodyInit | null,
  init: { method?: string; contentType?: string | null; contentLength?: number | null; correlationId?: string } = {},
): Request => {
  const headers = new Headers();
  if (init.contentType !== null) {
    headers.set("content-type", init.contentType ?? "application/json");
  }
  if (init.contentLength !== null && init.contentLength !== undefined) {
    headers.set("content-length", String(init.contentLength));
  }
  if (init.correlationId) {
    headers.set("x-correlation-id", init.correlationId);
  }
  return new Request("https://keys-pluto.example/v1/tenants", {
    method: init.method ?? "POST",
    headers,
    body,
  });
};

const passthroughSchema = <T>(v: T) => v;
const identitySchema = (input: unknown) => input as { name: string };

// --- correlation id ---------------------------------------------------------

test("newCorrelationId returns a non-empty string", () => {
  const id = newCorrelationId();
  assert.equal(typeof id, "string");
  assert.ok(id.length > 0);
});

test("newCorrelationId returns a different value on each call", () => {
  const a = newCorrelationId();
  const b = newCorrelationId();
  assert.notEqual(a, b);
});

test("readOrCreateCorrelationId honors a valid inbound x-correlation-id", () => {
  const req = buildRequest(null, { correlationId: "abc-123" });
  assert.equal(readOrCreateCorrelationId(req), "abc-123");
});

test("readOrCreateCorrelationId generates one when the header is absent", () => {
  const req = buildRequest(null);
  assert.equal(readOrCreateCorrelationId(req).length > 0, true);
});

test("readOrCreateCorrelationId ignores an oversized inbound header", () => {
  const req = buildRequest(null, { correlationId: "x".repeat(129) });
  const id = readOrCreateCorrelationId(req);
  assert.notEqual(id, "x".repeat(129));
  assert.equal(id.length <= 128, true);
});

// --- isProduction / productionGate -----------------------------------------

test("isProduction recognizes the production environment string", () => {
  assert.equal(isProduction({ ENVIRONMENT: "production" }), true);
  assert.equal(isProduction({ ENVIRONMENT: "development" }), false);
  assert.equal(isProduction({ ENVIRONMENT: "staging" }), false);
  assert.equal(isProduction({ ENVIRONMENT: "PRODUCTION" }), false);
});

test("productionGate is a no-op in non-production environments", () => {
  const req = buildRequest(null);
  assert.equal(productionGate(req, { ENVIRONMENT: "development" }), null);
  assert.equal(productionGate(req, { ENVIRONMENT: "staging" }), null);
});

test("productionGate allows /healthz through even in production", () => {
  const healthReq = new Request("https://keys-pluto.example/healthz", { method: "GET" });
  assert.equal(productionGate(healthReq, { ENVIRONMENT: "production" }), null);
});

test("productionGate returns 501 for any non-health route in production", async () => {
  const req = buildRequest(null);
  const res = productionGate(req, { ENVIRONMENT: "production" });
  assert.ok(res);
  assert.equal(res.status, 501);
  assert.equal(res.headers.get("x-correlation-id") !== null, true);
  const body = await res.json();
  assert.equal(body.error.code, "not_implemented_in_production");
});

// --- errorResponse ----------------------------------------------------------

test("errorResponse builds a fixed-shape body with no sensitive leak surface", async () => {
  const res = errorResponse(400, "bad_input", "the input was bad", "corr-1");
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-correlation-id"), "corr-1");
  const body = await res.json();
  assert.deepEqual(body, { error: { code: "bad_input", message: "the input was bad", correlationId: "corr-1" } });
});

test("jsonResponse mirrors errorResponse headers for symmetry", async () => {
  const res = jsonResponse(200, { ok: true }, "corr-2");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("x-correlation-id"), "corr-2");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { ok: true });
});

test("jsonResponse is the same shape Response.json would produce, plus correlation id and no-store", async () => {
  // Backwards-compat guarantee: the M0.2 acceptance criterion says
  // /healthz is byte-identical. We don't refactor /healthz to use
  // jsonResponse (which would add an x-correlation-id header), but
  // the content-type + cache-control + body shape match Response.json.
  const res = jsonResponse(200, { status: "ok", service: "keys" }, "corr-health");
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { status: "ok", service: "keys" });
});

// --- parseJsonRequest: method + content-type --------------------------------

test("parseJsonRequest rejects non-POST/PUT/PATCH methods with 405", async () => {
  // GET cannot carry a body in the Fetch API; build the request with
  // method-only init.
  const req = new Request("https://keys-pluto.example/v1/tenants", { method: "GET" });
  const res = await parseJsonRequest(req, { schema: passthroughSchema });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.status, 405);
  const body = await res.response.json();
  assert.equal(body.error.code, "method_not_allowed");
});

test("parseJsonRequest rejects non-JSON content-type with 415", async () => {
  const req = buildRequest("name=alice", { contentType: "application/x-www-form-urlencoded" });
  const res = await parseJsonRequest(req, { schema: passthroughSchema });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.status, 415);
  const body = await res.response.json();
  assert.equal(body.error.code, "unsupported_media_type");
});

test("parseJsonRequest accepts a JSON body and runs the schema", async () => {
  const req = buildRequest(JSON.stringify({ name: "acme" }));
  const res = await parseJsonRequest(req, { schema: identitySchema });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.value, { name: "acme" });
  assert.equal(typeof res.correlationId, "string");
});

// --- parseJsonRequest: body size --------------------------------------------

test("parseJsonRequest rejects an oversized content-length header with 413", async () => {
  // The rejection is on the header alone, which is the right place to
  // fail fast. The body is a tiny "{}" string.
  const headers = new Headers({
    "content-type": "application/json",
    "content-length": "65537",
  });
  const r = new Request("https://keys-pluto.example/v1/tenants", {
    method: "POST",
    headers,
    body: "{}",
  });
  const res = await parseJsonRequest(r, { schema: passthroughSchema });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.status, 413);
});

test("parseJsonRequest rejects an actually-oversized body with 413", async () => {
  const big = "x".repeat(1024);
  const res = await parseJsonRequest(buildRequest(big), {
    schema: passthroughSchema,
    maxBytes: 100,
  });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.status, 413);
  const body = await res.response.json();
  assert.equal(body.error.code, "payload_too_large");
});

// --- parseJsonRequest: malformed JSON ---------------------------------------

test("parseJsonRequest rejects malformed JSON with 400", async () => {
  const res = await parseJsonRequest(buildRequest("{ not json"), {
    schema: passthroughSchema,
  });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.status, 400);
  const body = await res.response.json();
  assert.equal(body.error.code, "malformed_json");
});

// --- parseJsonRequest: schema mismatch -------------------------------------

test("parseJsonRequest surfaces a SchemaError reason code as 400", async () => {
  const schema = (input: unknown) => {
    if (typeof input !== "object" || input === null || !("name" in input)) {
      throw new SchemaError("missing_field", "field 'name' is required");
    }
    return input as { name: string };
  };
  const res = await parseJsonRequest(buildRequest("{}"), { schema });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.status, 400);
  const body = await res.response.json();
  assert.equal(body.error.code, "missing_field");
  assert.equal(body.error.message, "field 'name' is required");
});

test("parseJsonRequest maps any other thrown error to schema_mismatch", async () => {
  const schema = () => {
    throw new Error("internal validator panic");
  };
  const res = await parseJsonRequest(buildRequest("{}"), { schema });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.status, 400);
  const body = await res.response.json();
  assert.equal(body.error.code, "schema_mismatch");
  // The validator's internal message must not leak.
  assert.equal(body.error.message.includes("panic"), false);
});

// --- parseJsonRequest: correlation id propagation --------------------------

test("parseJsonRequest propagates an inbound x-correlation-id to the success path", async () => {
  const req = buildRequest("{}", { correlationId: "trace-7" });
  const res = await parseJsonRequest(req, { schema: passthroughSchema });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.correlationId, "trace-7");
});

test("parseJsonRequest stamps the error response with a correlation id", async () => {
  const req = buildRequest("{ not json", { correlationId: "trace-9" });
  const res = await parseJsonRequest(req, { schema: passthroughSchema });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.response.headers.get("x-correlation-id"), "trace-9");
});

// --- isValidOrgSlug ---------------------------------------------------------

test("isValidOrgSlug accepts well-formed slugs", () => {
  assert.equal(isValidOrgSlug("acme"), true);
  assert.equal(isValidOrgSlug("acme-corp"), true);
  assert.equal(isValidOrgSlug("a-b-c"), true);
  assert.equal(isValidOrgSlug("pullpluto"), true);
});

test("isValidOrgSlug rejects malformed slugs", () => {
  assert.equal(isValidOrgSlug("Acme"), false); // uppercase
  assert.equal(isValidOrgSlug("-acme"), false); // leading hyphen
  assert.equal(isValidOrgSlug("acme-"), false); // trailing hyphen
  assert.equal(isValidOrgSlug("acme--corp"), false); // double hyphen handled by length
  assert.equal(isValidOrgSlug("acme corp"), false); // space
  assert.equal(isValidOrgSlug(""), false);
  assert.equal(isValidOrgSlug(123), false);
  assert.equal(isValidOrgSlug(null), false);
});

test("isValidOrgSlug rejects reserved slugs", () => {
  assert.equal(isValidOrgSlug("admin"), false);
  assert.equal(isValidOrgSlug("system"), false);
  assert.equal(isValidOrgSlug("syskey"), false);
  assert.equal(isValidOrgSlug("keys"), false);
  assert.equal(isValidOrgSlug("www"), false);
  assert.equal(isValidOrgSlug("api"), false);
});
