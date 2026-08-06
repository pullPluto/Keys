-- Forward-only foundation for the staged Authentik-replacement program.
-- This creates no active users, applications, roles, or credentials.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  primary_email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'suspended', 'deprovisioned')),
  created_at TEXT NOT NULL,
  activated_at TEXT,
  UNIQUE (organization_id, primary_email)
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('standard', 'elevated', 'privileged')),
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_at TEXT NOT NULL,
  UNIQUE (organization_id, key)
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  owner_identity_id TEXT REFERENCES identities(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'suspended', 'retired')),
  criticality TEXT NOT NULL CHECK (criticality IN ('standard', 'important', 'critical')),
  configuration_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS application_access_profiles (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  configuration_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (application_id, key)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  granted_by_identity_id TEXT NOT NULL REFERENCES identities(id),
  approved_by_identity_id TEXT REFERENCES identities(id),
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'active', 'revoked')),
  created_at TEXT NOT NULL,
  activated_at TEXT,
  revoked_at TEXT,
  UNIQUE (user_id, role_id, status)
);

CREATE TABLE IF NOT EXISTS provisioning_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  submitted_by_identity_id TEXT NOT NULL REFERENCES identities(id),
  request_source TEXT NOT NULL CHECK (request_source IN ('hr', 'sysadmin', 'manual')),
  subject_email TEXT NOT NULL,
  requested_access_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_sysadmin', 'approved', 'rejected', 'cancelled', 'provisioned')),
  idempotency_key TEXT NOT NULL UNIQUE,
  submitted_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by_identity_id TEXT REFERENCES identities(id),
  decision_note TEXT
);

CREATE INDEX IF NOT EXISTS users_org_status ON users (organization_id, status);
CREATE INDEX IF NOT EXISTS provisioning_queue ON provisioning_requests (organization_id, status, submitted_at);
CREATE INDEX IF NOT EXISTS applications_org_status ON applications (organization_id, status);
