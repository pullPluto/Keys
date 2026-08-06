-- Forward-only control-plane foundation. Apply with Wrangler after an owner has
-- reviewed the data-classification and retention decisions in docs/security.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  credential_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policy_documents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  version INTEGER NOT NULL,
  document_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'superseded')),
  created_at TEXT NOT NULL,
  activated_at TEXT,
  UNIQUE (organization_id, version)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_identity_id TEXT REFERENCES identities(id),
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed', 'denied', 'error')),
  occurred_at TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_org_time ON audit_events (organization_id, occurred_at);
CREATE INDEX IF NOT EXISTS identities_org ON identities (organization_id);
