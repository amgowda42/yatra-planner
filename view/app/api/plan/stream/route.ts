import { proxyYatraRequest } from "@/lib/plan-proxy";

export function POST(request: Request) {
  return proxyYatraRequest(request, "POST", "/plan/stream");
}
