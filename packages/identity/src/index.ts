// packages/identity/src/index.ts
//
// Identity domain contracts. No Cloudflare types leak in here — the
// D1 implementation lives in packages/identity/src/d1 and is the
// only place SQL is written.

export type OrganizationId = string & { readonly __brand: "OrganizationId" };
export type IdentityId = string & { readonly __brand: "IdentityId" };

/** A UUID v4-shaped string. Used for stable cross-tool identity. */
export type UserUuid = string & { readonly __brand: "UserUuid" };

export const asOrganizationId = (s: string): OrganizationId => s as OrganizationId;
export const asIdentityId = (s: string): IdentityId => s as IdentityId;
export const asUserUuid = (s: string): UserUuid => s as UserUuid;

export interface Organization {
  id: OrganizationId;
  slug: string;
  status: "active" | "suspended";
  createdAt: string;
}

export interface Identity {
  id: IdentityId;
  organizationId: OrganizationId;
  provider: string;
  providerSubject: string;
  status: "active" | "disabled";
  createdAt: string;
}

/** Repository: read + write of organization rows. SQL lives in
 *  packages/identity/src/d1; the route layer only sees this. */
export interface OrganizationRepository {
  findBySlug(slug: string): Promise<Organization | null>;
  findById(id: OrganizationId): Promise<Organization | null>;
  insert(org: Organization): Promise<void>;
}

export interface IdentityRepository {
  findActive(
    organizationId: OrganizationId,
    provider: string,
    subject: string,
  ): Promise<Identity | null>;
  findById(id: IdentityId): Promise<Identity | null>;
  /** Idempotent insert: if a row already exists with the same
   *  (organization, provider, subject) tuple, returns the existing
   *  identity instead of inserting. */
  upsert(input: {
    organizationId: OrganizationId;
    provider: string;
    providerSubject: string;
    status: "active" | "disabled";
    createdAt: string;
  }): Promise<{ identity: Identity; created: boolean }>;
}

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}

/** Use-case: create a draft organization. The MVP lets anyone with
 *  a verified dev principal create a tenant; production must gate
 *  this behind a registered application with the
 *  `tenants.create` capability. */
export interface TenantService {
  createDraft(input: { slug: string }): Promise<Organization>;
}

/** Concrete TenantService backed by a repository. Generates the id
 *  with `crypto.randomUUID()`. Slug uniqueness is enforced by the
 *  SQL UNIQUE constraint; the service translates the underlying
 *  error into a DomainError with code `slug_taken`. */
export class DefaultTenantService implements TenantService {
  constructor(
    private readonly repo: OrganizationRepository,
    private readonly newId: () => string = defaultIdGenerator,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async createDraft(input: { slug: string }): Promise<Organization> {
    const org: Organization = {
      id: asOrganizationId(this.newId()),
      slug: input.slug,
      status: "active",
      createdAt: this.now(),
    };
    try {
      await this.repo.insert(org);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new DomainError("slug_taken", 409, `organization slug already in use: ${input.slug}`);
      }
      throw e;
    }
    return org;
  }
}

/** Use-case: register an external identity link under a tenant. */
export class IdentityService {
  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly identities: IdentityRepository,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}
  async register(input: {
    organizationId: OrganizationId;
    provider: string;
    providerSubject: string;
  }): Promise<{ identity: Identity; created: boolean }> {
    const org = await this.orgs.findById(input.organizationId);
    if (!org) {
      throw new DomainError("unknown_tenant", 404, `no organization with id ${input.organizationId}`);
    }
    if (org.status !== "active") {
      throw new DomainError("tenant_suspended", 403, `organization ${org.slug} is suspended`);
    }
    return this.identities.upsert({
      organizationId: input.organizationId,
      provider: input.provider,
      providerSubject: input.providerSubject,
      status: "active",
      createdAt: this.now(),
    });
  }
}

/** Default id generator. Uses crypto.randomUUID when available. */
export function defaultIdGenerator(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c!.getRandomValues(bytes);
  // RFC 4122 v4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Heuristic: a SQL unique-constraint violation. Real Cloudflare D1
 *  errors expose a cause with code 1100 or a message containing
 *  "UNIQUE constraint failed"; the in-memory test harness throws
 *  "UNIQUE conflict" or "PRIMARY KEY conflict". Either is enough. */
function isUniqueViolation(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const msg = e.message;
  return (
    /UNIQUE constraint failed/i.test(msg) ||
    /UNIQUE conflict/i.test(msg) ||
    /PRIMARY KEY conflict/i.test(msg) ||
    /SQLITE_CONSTRAINT/i.test(msg)
  );
}
