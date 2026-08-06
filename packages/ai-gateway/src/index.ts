import type { OrganizationId } from "../../identity/src";

export interface ModelRequest {
  organizationId: OrganizationId;
  model: string;
  capability: "chat" | "embeddings" | "image";
  requestId: string;
}

export interface ModelProvider {
  invoke(request: ModelRequest): Promise<Response>;
}
