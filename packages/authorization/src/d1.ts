// packages/authorization/src/d1.ts
//
// D1 implementation of PolicyStore. The only place SQL for
// policy_documents lives. The activation is a 3-step
// transaction (supersede current active, insert/activate the
// new one) that we model with two writes; the in-memory harness
// preserves the same semantics.

import type { D1Database, D1PreparedStatement } from "../../identity/src/d1";
import type { OrganizationId, IdentityId } from "../../identity/src";
import { asOrganizationId, asIdentityId } from "../../identity/src";
import type { PolicyBody, PolicyDocument, PolicyStore } from "./index";

interface PolicyRow {
  id: string;
  organization_id: string;
  version: number;
  document_json: string;
  status: string;
  created_at: string;
  activated_at: string | null;
}

const rowToDoc = (r: PolicyRow): PolicyDocument => ({
  id: r.id,
  organizationId: asOrganizationId(r.organization_id),
  version: r.version,
  document: JSON.parse(r.document_json) as PolicyBody,
  status: r.status === "active" ? "active" : r.status === "superseded" ? "superseded" : "draft",
  createdAt: r.created_at,
  activatedAt: r.activated_at,
});

export class D1PolicyStore implements PolicyStore {
  constructor(private readonly db: D1Database) {}
  async findActive(organizationId: OrganizationId): Promise<PolicyDocument | null> {
    const row = await this.db
      .prepare(
        "SELECT id, organization_id, version, document_json, status, created_at, activated_at FROM policy_documents WHERE organization_id = ? AND status = 'active'",
      )
      .bind(organizationId)
      .first<PolicyRow>();
    return row ? rowToDoc(row) : null;
  }
  async findById(id: string): Promise<PolicyDocument | null> {
    const row = await this.db
      .prepare(
        "SELECT id, organization_id, version, document_json, status, created_at, activated_at FROM policy_documents WHERE id = ?",
      )
      .bind(id)
      .first<PolicyRow>();
    return row ? rowToDoc(row) : null;
  }
  async insert(doc: PolicyDocument): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO policy_documents (id, organization_id, version, document_json, status, created_at, activated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        doc.id,
        doc.organizationId,
        doc.version,
        JSON.stringify(doc.document),
        doc.status,
        doc.createdAt,
        doc.activatedAt,
      )
      .run();
  }
  async activate(id: string, now: string): Promise<PolicyDocument> {
    const target = await this.findById(id);
    if (!target) throw new Error(`no such policy: ${id}`);
    if (target.status === "active") return target; // idempotent
    if (target.status !== "draft") {
      throw new Error(`cannot activate a ${target.status} policy`);
    }
    // Supersede any current active.
    const current = await this.findActive(target.organizationId);
    if (current) {
      await this.db
        .prepare(
          "UPDATE policy_documents SET status = 'superseded' WHERE id = ?",
        )
        .bind(current.id)
        .run();
    }
    await this.db
      .prepare(
        "UPDATE policy_documents SET status = 'active', activated_at = ? WHERE id = ?",
      )
      .bind(now, id)
      .run();
    const updated = await this.findById(id);
    if (!updated) throw new Error("policy disappeared during activation");
    return updated;
  }
}

/** Compute the next version number for a tenant by reading the
 *  current max(version) and adding 1. */
export async function nextVersion(
  db: D1Database,
  organizationId: OrganizationId,
): Promise<number> {
  const row = await db
    .prepare(
      "SELECT MAX(version) AS max_version FROM policy_documents WHERE organization_id = ?",
    )
    .bind(organizationId)
    .first<{ max_version: number | null }>();
  return (row?.max_version ?? 0) + 1;
}
