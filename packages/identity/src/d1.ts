// packages/identity/src/d1.ts
//
// D1 implementation of the identity repositories. The only place in
// the Worker that writes SQL for organizations/identities. The
// harness in tests/_support/env.ts exposes a structurally
// compatible D1Database; production uses the real Cloudflare binding.

import type {
  Identity,
  IdentityId,
  IdentityRepository,
  Organization,
  OrganizationId,
  OrganizationRepository,
} from "./index";
import { asIdentityId, asOrganizationId } from "./index";

/** Structural D1 shape the package relies on. Mirrors
 *  @cloudflare/workers-types' D1Database for the methods we use. */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface D1PreparedStatement {
  bind(...params: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface OrganizationRow {
  id: string;
  slug: string;
  status: string;
  created_at: string;
}

interface IdentityRow {
  id: string;
  organization_id: string;
  provider: string;
  provider_subject: string;
  status: string;
  created_at: string;
}

const rowToOrganization = (r: OrganizationRow): Organization => ({
  id: asOrganizationId(r.id),
  slug: r.slug,
  status: r.status === "suspended" ? "suspended" : "active",
  createdAt: r.created_at,
});

const rowToIdentity = (r: IdentityRow): Identity => ({
  id: asIdentityId(r.id),
  organizationId: asOrganizationId(r.organization_id),
  provider: r.provider,
  providerSubject: r.provider_subject,
  status: r.status === "disabled" ? "disabled" : "active",
  createdAt: r.created_at,
});

export class D1OrganizationRepository implements OrganizationRepository {
  constructor(private readonly db: D1Database) {}
  async findBySlug(slug: string): Promise<Organization | null> {
    const row = await this.db
      .prepare("SELECT id, slug, status, created_at FROM organizations WHERE slug = ?")
      .bind(slug)
      .first<OrganizationRow>();
    return row ? rowToOrganization(row) : null;
  }
  async findById(id: OrganizationId): Promise<Organization | null> {
    const row = await this.db
      .prepare("SELECT id, slug, status, created_at FROM organizations WHERE id = ?")
      .bind(id)
      .first<OrganizationRow>();
    return row ? rowToOrganization(row) : null;
  }
  async insert(org: Organization): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO organizations (id, slug, status, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(org.id, org.slug, org.status, org.createdAt)
      .run();
  }
}

export class D1IdentityRepository implements IdentityRepository {
  constructor(
    private readonly db: D1Database,
    private readonly newId: () => string,
  ) {}
  async findActive(
    organizationId: OrganizationId,
    provider: string,
    subject: string,
  ): Promise<Identity | null> {
    const row = await this.db
      .prepare(
        "SELECT id, organization_id, provider, provider_subject, status, created_at FROM identities WHERE organization_id = ? AND provider = ? AND provider_subject = ? AND status = 'active'",
      )
      .bind(organizationId, provider, subject)
      .first<IdentityRow>();
    return row ? rowToIdentity(row) : null;
  }
  async findById(id: IdentityId): Promise<Identity | null> {
    const row = await this.db
      .prepare(
        "SELECT id, organization_id, provider, provider_subject, status, created_at FROM identities WHERE id = ?",
      )
      .bind(id)
      .first<IdentityRow>();
    return row ? rowToIdentity(row) : null;
  }
  async upsert(input: {
    organizationId: OrganizationId;
    provider: string;
    providerSubject: string;
    status: "active" | "disabled";
    createdAt: string;
  }): Promise<{ identity: Identity; created: boolean }> {
    // Pre-check: if a row with the same (organization, provider, subject)
    // tuple already exists, return it without trying to insert. This
    // is the portable way to express "upsert" against an arbitrary D1
    // surface (production or the in-memory harness).
    const existing = await this.findActive(
      input.organizationId,
      input.provider,
      input.providerSubject,
    );
    if (existing) {
      return { created: false, identity: existing };
    }
    const newId = this.newId();
    try {
      await this.db
        .prepare(
          "INSERT INTO identities (id, organization_id, provider, provider_subject, status, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(newId, input.organizationId, input.provider, input.providerSubject, input.status, input.createdAt)
        .run();
      return {
        created: true,
        identity: {
          id: asIdentityId(newId),
          organizationId: input.organizationId,
          provider: input.provider,
          providerSubject: input.providerSubject,
          status: input.status,
          createdAt: input.createdAt,
        },
      };
    } catch (e) {
      // Detect a unique-constraint violation (race between the
      // pre-check and the insert). Read whatever's there.
      if (!isUniqueViolation(e)) throw e;
      const fallback = await this.db
        .prepare(
          "SELECT id, organization_id, provider, provider_subject, status, created_at FROM identities WHERE organization_id = ? AND provider = ? AND provider_subject = ?",
        )
        .bind(input.organizationId, input.provider, input.providerSubject)
        .first<IdentityRow>();
      if (!fallback) throw new Error("identity upsert: insert failed but row not found");
      return { created: false, identity: rowToIdentity(fallback) };
    }
  }
}

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

/** Build a complete identity domain from a D1 binding. */
export function createD1IdentityDomain(
  db: D1Database,
  newId: () => string,
): { orgs: OrganizationRepository; identities: IdentityRepository } {
  return {
    orgs: new D1OrganizationRepository(db),
    identities: new D1IdentityRepository(db, newId),
  };
}
