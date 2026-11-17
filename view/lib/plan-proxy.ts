const DEFAULT_YATRA_API_ORIGIN = "http://127.0.0.1:8000";

type YatraMethod = "GET" | "POST" | "DELETE";
type YatraEndpoint = "/" | "/plan/" | "/plan/stream" | "/plan/cache-stats";

export async function proxyYatraRequest(
  request: Request,
  method: YatraMethod,
  endpoint: YatraEndpoint,
  query = "",
): Promise<Response> {
  const apiOrigin = (
    process.env.YATRA_API_BASE_URL?.trim() || DEFAULT_YATRA_API_ORIGIN
  ).replace(/\/+$/, "");

  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin}${endpoint}${query}`, {
      method,
      headers: new Headers({
        ...(method === "POST"
          ? {
              "Content-Type":
                request.headers.get("content-type") ?? "application/json",
            }
          : {}),
        Accept:
          endpoint === "/plan/stream"
            ? "text/event-stream"
            : "application/json",
      }),
      ...(method === "POST" ? { body: await request.text() } : {}),
      cache: "no-store",
      signal: request.signal,
    });
  } catch (error) {
    console.error("Unable to reach the Yatra API.", error);
    return Response.json(
      {
        detail:
          "Unable to reach the Yatra API. Check that the backend is running and YATRA_API_BASE_URL is correct.",
      },
      { status: 502 },
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Cache-Control", "no-store");

  if (endpoint === "/plan/stream") {
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("X-Accel-Buffering", "no");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
