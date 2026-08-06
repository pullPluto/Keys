export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type IdentityId = string & { readonly __brand: "IdentityId" };

export interface Identity {
  id: IdentityId;
  organizationId: OrganizationId;
  provider: string;
  providerSubject: string;
  status: "active" | "disabled";
}

export interface IdentityRepository {
  findActive(organizationId: OrganizationId, provider: string, subject: string): Promise<Identity | null>;
}
