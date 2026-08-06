// tests/_support/sequences.ts
//
// Build a sequence of pre-signed authenticated Requests for the
// cross-route test. Each request carries a valid dev HMAC token.
// This is the only place tests construct authenticated requests.

import worker from "../../apps/worker/src/index";
import { signDevToken, type DevTokenPayload } from "../../packages/authentication/src";
import { createTestEnv, type TestEnv } from "./env";

export interface SequenceOptions {
  env: TestEnv;
  /** Identity subject used in the dev credential. The dev
   *  HMAC verifier treats this as provider_subject. */
  subject: string;
  /** Correlation id stamped on every request via x-correlation-id.
   *  Default: a new UUID. */
  correlationId?: string;
  /** Override the issuer / audience used for the token. Defaults
   *  to the values the dev verifier expects. */
  issuer?: string;
  audience?: string;
  /** Override the secret. Default: env.MVP_HMAC_SECRET. */
  secret?: string;
}

export interface SequenceRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface SequenceResult {
  correlationId: string;
  responses: Response[];
}

export async function runSequence(
  requests: SequenceRequest[],
  options: SequenceOptions,
): Promise<SequenceResult> {
  const secret = options.secret ?? options.env.MVP_HMAC_SECRET ?? "dev-only-do-not-use-in-production";
  const issuer = options.issuer ?? "keys-pluto-dev";
  const audience = options.audience ?? "keys-pluto";
  const correlationId = options.correlationId ?? crypto.randomUUID();

  const now = Math.floor(Date.now() / 1000);
  const payload: DevTokenPayload = {
    iss: issuer,
    aud: audience,
    sub: options.subject,
    iat: now,
    exp: now + 600,
  };
  const token = await signDevToken(payload, secret);

  const responses: Response[] = [];
  for (const req of requests) {
    const headers = new Headers({
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-correlation-id": correlationId,
    });
    const body = req.body === undefined ? undefined : JSON.stringify(req.body);
    const url = `https://keys-pluto.example${req.path}`;
    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    });
    const response = await worker.fetch(request, options.env);
    responses.push(response);
  }
  return { correlationId, responses };
}

/** A shortcut that builds an env with bootstrapAdmins set. */
export function mvpEnv(overrides: { bootstrapAdmins?: string[]; hmacSecret?: string; authorizationCache?: boolean } = {}): TestEnv {
  return createTestEnv({
    bootstrapAdmins: overrides.bootstrapAdmins ?? ["bootstrap-admin"],
    hmacSecret: overrides.hmacSecret ?? "test-secret",
    authorizationCache: overrides.authorizationCache,
  });
}
