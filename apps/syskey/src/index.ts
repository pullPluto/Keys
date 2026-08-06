const worker = {
  fetch(request: Request): Response {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/healthz") {
      return Response.json(
        { status: "ok", service: "syskey", mode: "deny-by-default" },
        { headers: { "cache-control": "no-store" } },
      );
    }
    return new Response("Not found", { status: 404 });
  },
};

export default worker;
