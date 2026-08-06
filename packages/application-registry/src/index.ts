import type { IdentityId, OrganizationId } from "../../identity/src";

export type ApplicationProtocol =
  | "oidc"
  | "oauth_client_credentials"
  | "saml"
  | "scim"
  | "proxy_auth"
  | "ldap_bridge"
  | "service_account";

export interface ApplicationRegistration {
  organizationId: OrganizationId;
  slug: string;
  displayName: string;
  ownerIdentityId: IdentityId;
  protocols: readonly ApplicationProtocol[];
  redirectUris: readonly string[];
  postLogoutRedirectUris: readonly string[];
  accessProfiles: readonly string[];
  criticality: "standard" | "important" | "critical";
}

export interface ApplicationRegistry {
  createDraft(registration: ApplicationRegistration): Promise<{ id: string }>;
}
