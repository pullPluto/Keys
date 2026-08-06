# Cloudflare infrastructure

## Canonical resource names

| Resource | Name | Worker binding | Intended role |
| --- | --- | --- | --- |
| Worker | `keys-pluto` | n/a | public enforcement boundary |
| D1 database | `keys-pluto` | `KEYS_DB` | durable control-plane state |
| KV namespace | `keys-pluto` | `KEYS_KV` | bounded, reconstructable cache |
| R2 bucket | `keys-pluto` | `KEYS_R2` | approved artifact retention |

Cloudflare assigns database and namespace IDs. Those IDs are environment/account-specific sensitive configuration and must stay in the ignored `apps/worker/wrangler.jsonc`, CI secrets/configuration, or another approved configuration system. The R2 bucket name is a binding value, not a credential.

Use `apps/worker/wrangler.example.jsonc` as the configuration contract. There is intentionally no checked-in deployable production configuration because account, environment, routes, and IDs have not been provided.
