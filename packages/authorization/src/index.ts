import type { IdentityId, OrganizationId } from "../../identity/src";

export interface AuthorizationRequest {
  organizationId: OrganizationId;
  subjectId: IdentityId;
  action: string;
  resource: string;
  context: Readonly<Record<string, string>>;
}

export interface AuthorizationDecision {
  effect: "allow" | "deny";
  policyVersion: number;
  reasonCode: string;
}

export interface PolicyEngine {
  decide(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}
