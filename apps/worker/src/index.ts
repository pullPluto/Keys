// apps/worker/src/index.ts
//
// Worker entry point. Dispatches the four MVP routes plus
// /healthz. The envelope's production gate is applied inside
// each handler so 501 is returned for any non-health route in
// production.

import { healthResponse } from "./routes/health";
import { handlePostTenant } from "./routes/tenants";
import { handlePostIdentity, handlePostAuthVerify } from "./routes/identities";
import { handlePostPolicy, handlePostPolicyActivate } from "./routes/policies";
import { handlePostAuthorize } from "./routes/authorize";
import { errorResponse, readOrCreateCorrelationId } from "./http/envelope";
import type { Env } from "./env";

const notFound = (request: Request): Response => {
  const correlationId = readOrCreateCorrelationId(request);
  return errorResponse(404, "not_found", "no route matches the request", correlationId);
};

const worker = {
  fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/healthz") {
      return Promise.resolve(healthResponse());
    }
    if (request.method === "POST" && pathname === "/v1/tenants") {
      return Promise.resolve(handlePostTenant(request, env));
    }
    if (request.method === "POST" && pathname === "/v1/auth/verify") {
      return Promise.resolve(handlePostAuthVerify(request, env));
    }
    if (request.method === "POST" && pathname === "/v1/identities") {
      return Promise.resolve(handlePostIdentity(request, env));
    }
    if (request.method === "POST" && pathname === "/v1/policies") {
      return Promise.resolve(handlePostPolicy(request, env));
    }
    if (request.method === "POST" && pathname.startsWith("/v1/policies/") && pathname.endsWith("/activate")) {
      const id = pathname.slice("/v1/policies/".length, -"/activate".length);
      return Promise.resolve(handlePostPolicyActivate(request, env, id));
    }
    if (request.method === "POST" && pathname === "/v1/authorize") {
      return Promise.resolve(handlePostAuthorize(request, env));
    }
    return Promise.resolve(notFound(request));
  },
};

export default worker;
