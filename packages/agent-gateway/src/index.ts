import type { OrganizationId } from "../../identity/src";

export interface AgentInvocation {
  organizationId: OrganizationId;
  agentId: string;
  requestedCapabilities: readonly string[];
  correlationId: string;
}
