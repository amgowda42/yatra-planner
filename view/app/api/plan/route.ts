import { proxyYatraRequest } from "@/lib/plan-proxy";

export function POST(request: Request) {
  return proxyYatraRequest(request, "POST", "/plan/");
}

export function DELETE(request: Request) {
  return proxyYatraRequest(request, "DELETE", "/plan/");
}
