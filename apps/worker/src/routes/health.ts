export function healthResponse(): Response {
  return Response.json(
    { status: "ok", service: "keys" },
    { headers: { "cache-control": "no-store" } },
  );
}
