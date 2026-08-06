# Architecture overview

## Purpose

Keys is a policy enforcement point and control-plane record for PullPluto services. It is not a directory service, general-purpose secrets manager, or data warehouse. The initial deployment is one Cloudflare Worker named `keys-pluto` bound to D1, KV, and R2 resources sharing that name.

## Bounded contexts

| Module | Owns | Must not own |
| --- | --- | --- |
| identity | organization and external identity linkage | credential verification |
| authentication | proof verification and principal construction | access decisions |
| authorization | policy evaluation and reasoned decisions | provider/model transport |
| ai-gateway | provider routing after authorization | tenant identity source of truth |
| agent-gateway | agent invocation and capability envelope | direct tool permission bypass |
| mcp-policy | MCP server/tool decision contract | raw tool execution |
| audit | normalized append-only event contract | sensitive payload retention |

## Deployment shape

```text
Client → Cloudflare Worker (keys-pluto) → policy/auth adapters → provider or MCP adapter
                    │                         │
                    ├── D1 keys-pluto          └── external services (not yet selected)
                    ├── KV keys-pluto
                    └── R2 keys-pluto
```

The Worker is the external enforcement boundary. Domain packages must remain portable TypeScript contracts; a Cloudflare binding is accessed only in a delivery or adapter layer. The single-Worker shape is a starting point, not a permanent scaling commitment. Its upgrade trigger is documented in ADR-001.

## Storage roles

- **D1:** durable organizations, identity links, client metadata, policy versions, and audit-event index/record. Authorization evaluates from a current policy record, not KV.
- **KV:** explicitly bounded, disposable cached material only. It cannot be the source of truth for revocation, policy activation, or audit completion.
- **R2:** retention of approved artifacts such as encrypted exports or larger audit payload references. Object keys and lifecycle must prevent tenant mixing. No payload-retention policy has been approved.

## Non-goals in this increment

OIDC/OAuth issuance, WebAuthn/TOTP, user interface, LDAP compatibility, provider credentials, model proxying, tool execution, rate limiting, production tenancy migration, and remote resource provisioning are deliberately outside the initial scaffold.
