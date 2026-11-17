import { proxyYatraRequest } from "@/lib/plan-proxy";

export function GET(request: Request) {
  return proxyYatraRequest(request, "GET", "/", new URL(request.url).search);
}
