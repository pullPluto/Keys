import type { Env } from "./env";
import { healthResponse } from "./routes/health";

const notFound = () => new Response("Not found", { status: 404 });

const worker = {
  fetch(request: Request, _env: Env): Response {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/healthz") return healthResponse();
    return notFound();
  },
};

export default worker;
