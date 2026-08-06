// packages/authorization/src/index.ts
//
// Authorization contracts. Decisions are evaluated against an
// active policy record in D1 (the source of truth), never from
// KV. The MVP language is intentionally small: a policy is a
// list of rules; a rule matches by (action, resource) and
// declares an effect. The first match wins. Default deny.

import type { OrganizationId, IdentityId } from "../../identity/src";

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

export interface PolicyDocument {
  id: string;
  organizationId: OrganizationId;
  version: number;
  document: PolicyBody;
  status: "draft" | "active" | "superseded";
  createdAt: string;
  activatedAt: string | null;
}

export interface PolicyBody {
  /** A flat list of rules. First match wins; if no rule matches,
   *  the decision is deny with reason `no_matching_rule`. */
  rules: readonly PolicyRule[];
}

export type PolicyEffect = "allow" | "deny";

export interface PolicyRule {
  /** Exact action match. `*` matches any action. */
  action: string;
  /** Exact resource match. `*` matches any resource. */
  resource: string;
  effect: PolicyEffect;
  /** Optional human-readable reason code recorded on the decision. */
  reasonCode?: string;
}

export interface PolicyStore {
  findActive(organizationId: OrganizationId): Promise<PolicyDocument | null>;
  findById(id: string): Promise<PolicyDocument | null>;
  insert(doc: PolicyDocument): Promise<void>;
  /** Activates the given draft. Atomically:
   *  1. set any current active doc to status=superseded
   *  2. set the given draft to status=active, activated_at=now
   *  Returns the resulting active doc. */
  activate(id: string, now: string): Promise<PolicyDocument>;
}

/** Default-deny policy engine. Reads the active policy from the
 *  store, then evaluates the request against its rules. If no
 *  policy is active, the decision is deny with reason
 *  `no_active_policy`. If a policy is active but no rule
 *  matches, the decision is deny with reason `no_matching_rule`. */
export class DefaultPolicyEngine implements PolicyEngine {
  constructor(private readonly store: PolicyStore) {}
  async decide(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const active = await this.store.findActive(request.organizationId);
    if (!active) {
      return {
        effect: "deny",
        policyVersion: 0,
        reasonCode: "no_active_policy",
      };
    }
    for (const rule of active.document.rules) {
      const actionMatch = rule.action === "*" || rule.action === request.action;
      const resourceMatch = rule.resource === "*" || rule.resource === request.resource;
      if (actionMatch && resourceMatch) {
        return {
          effect: rule.effect,
          policyVersion: active.version,
          reasonCode: rule.reasonCode ?? (rule.effect === "allow" ? "rule_match_allow" : "rule_match_deny"),
        };
      }
    }
    return {
      effect: "deny",
      policyVersion: active.version,
      reasonCode: "no_matching_rule",
    };
  }
}

/** Default PolicyStore. In-memory implementation for tests and
 *  for the bootstrap. The D1 implementation lives in
 *  packages/authorization/src/d1. */
export class InMemoryPolicyStore implements PolicyStore {
  private docs: PolicyDocument[] = [];
  async findActive(organizationId: OrganizationId): Promise<PolicyDocument | null> {
    return (
      this.docs.find(
        (d) => d.organizationId === organizationId && d.status === "active",
      ) ?? null
    );
  }
  async findById(id: string): Promise<PolicyDocument | null> {
    return this.docs.find((d) => d.id === id) ?? null;
  }
  async insert(doc: PolicyDocument): Promise<void> {
    this.docs.push(doc);
  }
  async activate(id: string, now: string): Promise<PolicyDocument> {
    const target = this.docs.find((d) => d.id === id);
    if (!target) throw new Error(`no such policy: ${id}`);
    if (target.status !== "draft") {
      // Re-activating an already-active version is a no-op + 200
      // (per M2.3). We return the existing active doc unchanged.
      if (target.status === "active") return target;
      throw new Error(`cannot activate a ${target.status} policy`);
    }
    for (const d of this.docs) {
      if (d.organizationId === target.organizationId && d.status === "active") {
        d.status = "superseded";
      }
    }
    target.status = "active";
    target.activatedAt = now;
    return target;
  }
}

/** Policy JSON schema (hand-rolled). The MVP accepts the body of
 *  `POST /v1/policies` and validates it with this function. */
export class PolicyValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PolicyValidationError";
    this.code = code;
  }
}

export function validatePolicyBody(input: unknown): PolicyBody {
  if (typeof input !== "object" || input === null) {
    throw new PolicyValidationError("body_not_object", "policy body must be a JSON object");
  }
  const obj = input as { rules?: unknown };
  if (!Array.isArray(obj.rules)) {
    throw new PolicyValidationError("missing_rules", "policy body must have a 'rules' array");
  }
  const rules: PolicyRule[] = obj.rules.map((r, i) => {
    if (typeof r !== "object" || r === null) {
      throw new PolicyValidationError(`rule_not_object`, `rules[${i}] must be an object`);
    }
    const rule = r as { action?: unknown; resource?: unknown; effect?: unknown; reasonCode?: unknown };
    if (typeof rule.action !== "string" || rule.action.length === 0) {
      throw new PolicyValidationError(`rule_missing_action`, `rules[${i}].action is required`);
    }
    if (typeof rule.resource !== "string" || rule.resource.length === 0) {
      throw new PolicyValidationError(`rule_missing_resource`, `rules[${i}].resource is required`);
    }
    if (rule.effect !== "allow" && rule.effect !== "deny") {
      throw new PolicyValidationError(`rule_bad_effect`, `rules[${i}].effect must be 'allow' or 'deny'`);
    }
    if (rule.reasonCode !== undefined && typeof rule.reasonCode !== "string") {
      throw new PolicyValidationError(`rule_bad_reason_code`, `rules[${i}].reasonCode must be a string`);
    }
    return {
      action: rule.action,
      resource: rule.resource,
      effect: rule.effect,
      reasonCode: typeof rule.reasonCode === "string" ? rule.reasonCode : undefined,
    };
  });
  return { rules };
}
