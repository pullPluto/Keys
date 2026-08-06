import type { Identity } from "../../identity/src";

export interface VerifiedCredential {
  issuer: string;
  audience: string;
  subject: string;
  expiresAt: Date;
}

export interface CredentialVerifier {
  verify(credential: string): Promise<VerifiedCredential>;
}

export interface AuthenticatedPrincipal {
  identity: Identity;
  credential: VerifiedCredential;
}
