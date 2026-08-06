// apps/worker/src/http/envelope.ts
//
// MVP request envelope for the keys-pluto Worker. Centralizes:
//   - JSON body parsing with a bounded byte cap
//   - Content-Type validation
//   - Correlation ID generation/propagation
//   - Normalized error responses (no sensitive payload leakage)
//   - Production gate (ENVIRONMENT === "production" returns 501 for
//     any non-health route, per the M0.2 acceptance criteria and
//     docs/operations/deployment.md)
//
// Design constraints:
//   - Dependency-free. No router framework, no validator library. The
//     schema is a hand-rolled predicate; Phase 4 can swap in something
//     heavier behind an ADR.
//   - Pure functions where possible. The Env parameter is the only
//     ambient input.
//
// Phase 1+ routes depend on this module, so changes here are visible
// to every other M0/M1/M2 issue. Keep the surface stable.

const DEFAULT_MAX_BYTES = 64 * 1024; // 64 KiB
const HEALTH_PATH = "/healthz";
const PROD_GATE_MESSAGE =
  "this route is not available in production; see the MVP backlog";
const CORRELATION_HEADER = "x-correlation-id";

/** Generate a correlation ID. Uses crypto.randomUUID when available,
 *  otherwise a 16-byte random hex string. Format is opaque; clients
 *  should treat it as a string and echo it back when reporting errors. */
export function newCorrelationId(): string {
  // crypto is available globally in the Cloudflare Workers runtime.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const bytes = new Uint8Array(16);
  c!.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read the correlation id from the inbound request, or generate one. */
export function readOrCreateCorrelationId(request: Request): string {
  const header = request.headers.get(CORRELATION_HEADER);
  if (header && header.length > 0 && header.length <= 128) {
    return header;
  }
  return newCorrelationId();
}

export interface EnvelopeOptions<T> {
  /** Predicate that validates the parsed body. Throw a `SchemaError`
   *  to surface a 400 with a stable reason code. */
  schema: (input: unknown) => T;
  /** Maximum body size in bytes. Default 64 KiB. */
  maxBytes?: number;
  /** If true, skip the production gate. Default false.
   *  Set true only for `/healthz`. */
  bypassProductionGate?: boolean;
}

export type EnvelopeResult<T> =
  | { ok: true; value: T; correlationId: string }
  | { ok: false; response: Response };

/** Outcome of a request that has been validated at the envelope layer
 *  but where the route itself decided not to handle the request. */
export interface BypassResult {
  ok: false;
  response: Response;
}

/** True iff env.ENVIRONMENT === "production". */
export function isProduction(env: { ENVIRONMENT: string }): boolean {
  return env.ENVIRONMENT === "production";
}

/** The MVP gates every non-health route behind a 501 in production.
 *  See M0.2 acceptance criteria. Returns the 501 response when the
 *  gate fires, or null when the request may proceed. */
export function productionGate(
  request: Request,
  env: { ENVIRONMENT: string },
): Response | null {
  if (!isProduction(env)) return null;
  if (new URL(request.url).pathname === HEALTH_PATH) return null;
  const correlationId = readOrCreateCorrelationId(request);
  return errorResponse(
    501,
    "not_implemented_in_production",
    PROD_GATE_MESSAGE,
    correlationId,
  );
}

/** Parse a JSON request body, validate it, and attach a correlation id.
 *  Always returns a discriminated result so routes do not need to
 *  distinguish thrown errors from intentional rejections. */
export async function parseJsonRequest<T>(
  request: Request,
  options: EnvelopeOptions<T>,
): Promise<EnvelopeResult<T>> {
  const correlationId = readOrCreateCorrelationId(request);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  // Method + content-type gate. Only POST/PUT/PATCH carry bodies.
  const method = request.method.toUpperCase();
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
    return {
      ok: false,
      response: errorResponse(
        405,
        "method_not_allowed",
        `method ${method} is not allowed on this route`,
        correlationId,
      ),
    };
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: errorResponse(
        415,
        "unsupported_media_type",
        "Content-Type must be application/json",
        correlationId,
      ),
    };
  }

  // Bounded body. We read into a Uint8Array, then JSON.parse.
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number.parseInt(contentLength, 10);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return {
        ok: false,
        response: errorResponse(
          413,
          "payload_too_large",
          `request body exceeds ${maxBytes} bytes`,
          correlationId,
        ),
      };
    }
  }

  const raw = await request.arrayBuffer();
  if (raw.byteLength > maxBytes) {
    return {
      ok: false,
      response: errorResponse(
        413,
        "payload_too_large",
        `request body exceeds ${maxBytes} bytes`,
        correlationId,
      ),
    };
  }

  let parsed: unknown;
  try {
    parsed = raw.byteLength === 0 ? null : JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return {
      ok: false,
      response: errorResponse(
        400,
        "malformed_json",
        "request body is not valid JSON",
        correlationId,
      ),
    };
  }

  let value: T;
  try {
    value = options.schema(parsed);
  } catch (e) {
    const reason = e instanceof SchemaError ? e.reason : "schema_mismatch";
    const message =
      e instanceof SchemaError ? e.message : "request body does not match the route schema";
    return {
      ok: false,
      response: errorResponse(400, reason, message, correlationId),
    };
  }

  return { ok: true, value, correlationId };
}

/** Build a normalized error response. The body shape is fixed:
 *  `{ error: { code, message, correlationId } }`. Never include the
 *  original request body, headers, or any other sensitive attribute.
 *  The response sets `cache-control: no-store` to keep error detail
 *  out of any caching layer. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): Response {
  const body = JSON.stringify({
    error: { code, message, correlationId },
  });
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-correlation-id": correlationId,
    },
  });
}

/** Build a success JSON response. Sets the same correlation id and
 *  `cache-control: no-store` for symmetry. */
export function jsonResponse(
  status: number,
  body: unknown,
  correlationId: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-correlation-id": correlationId,
    },
  });
}

/** Slug validator. Per the M0.2 description, the envelope "validates
 *  the org slug"; we expose the predicate as a function so routes
 *  that need it can call it, instead of baking the rule into the
 *  envelope's body parser. Format: lowercase letters, digits, and
 *  single hyphens, 3-40 characters, no leading or trailing hyphen,
 *  no consecutive hyphens, plus a small reserved-slug denylist. */
export function isValidOrgSlug(slug: unknown): slug is string {
  if (typeof slug !== "string") return false;
  if (slug.length < 3 || slug.length > 40) return false;
  if (!/^[a-z0-9](?:-?[a-z0-9]){1,38}$/.test(slug)) return false;
  switch (slug) {
    case "admin":
    case "system":
    case "syskey":
    case "keys":
    case "www":
    case "api":
      return false;
    default:
      return true;
  }
}

/** Schema error. Thrown by a route's schema predicate to surface a
 *  400 with a stable reason code. Any other thrown value is mapped
 *  to a generic `schema_mismatch` so the response never leaks the
 *  validator's internals. */
export class SchemaError extends Error {
  readonly reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = "SchemaError";
    this.reason = reason;
  }
}
