import type { IdentityId, OrganizationId } from "../../identity/src";

export interface ProvisioningRequest {
  organizationId: OrganizationId;
  submittedBy: IdentityId;
  source: "hr" | "sysadmin" | "manual";
  subjectEmail: string;
  requestedAccess: Readonly<Record<string, readonly string[]>>;
  idempotencyKey: string;
}

export interface ProvisioningQueue {
  submit(request: ProvisioningRequest): Promise<{ id: string; status: "pending_sysadmin" }>;
  approve(requestId: string, approver: IdentityId): Promise<void>;
  reject(requestId: string, approver: IdentityId, reasonCode: string): Promise<void>;
}
