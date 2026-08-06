# Keys replacement program

## Product decision

Keys is the future company-wide identity provider and replacement for Authentik. It will become the defining application for sign-in and access to PullPluto tools. This is an end state, not a claim that the current repository can yet authenticate or migrate users.

## Operating model

- **Initial accountable owner:** the user who commissioned this repository.
- **Cloudflare ownership:** the accountable owner manages Cloudflare owners and access.
- **SysAdmin:** may approve, provision, suspend, and revoke users; no HR-originated account becomes active without SysAdmin approval.
- **People Manage:** an HR-integrated role that may submit requested attributes and permissions for a new hire; it cannot activate an account or self-approve privileged access.
- **Two-person control:** a SysAdmin cannot approve their own request or grant their own elevated role. A separate eligible SysAdmin must approve it.

## Milestones

| Milestone | Outcome | Exit evidence |
| --- | --- | --- |
| 0. Governance and inventory | inventory every tool, owner, protocol, users, criticality, and migration order | reviewed inventory and owner assignments |
| 1. Secure platform | Cloudflare environments, CI, secrets, telemetry, recovery plan, and ownership controls | isolated environments and recovery exercise |
| 2. Core directory | organizations, users, apps, roles, groups, service accounts, and immutable audit design | tenant-isolation and migration tests |
| 3. Provisioning | HR request intake, SysAdmin queue, approval, revoke, and notification workflow | approval/segregation-of-duties tests |
| 4. OIDC issuer | application registration, authorization code + PKCE, signed tokens, JWKS, sessions, token rotation and revocation | external conformance/security review and low-risk app pilot |
| 5. Strong authentication | passkeys, TOTP, recovery, invite and device/session management | account-recovery and attack-path exercises |
| 6. Universal application registry | configurable app properties, access profiles, redirect URI controls, and per-app policy | first self-service app onboarded by an authorized SysAdmin |
| 7. Compatibility | OAuth client credentials, SAML, SCIM, proxy auth, LDAP bridge only where evidenced | each protocol has a real target integration and test suite |
| 8. SysKey resilience | separately deployed SysAdmin break-glass path, isolated credentials, drills and rollback | successful drills without weakening normal controls |
| 9. Authentik retirement | migrate tools in waves and remove dependency only after exit criteria are met | all inventory items migrated or explicitly excepted |
| 10. AI and agent policy | model, agent, MCP, budget and tool authorization | separate threat model and provider approval |

## Definition of production-ready

Keys is production-ready for a specific application only when the application has an owner, approved configuration, tested sign-in and logout, tested role removal/revocation, monitoring, audit review, recovery evidence, and rollback path. The platform is not production-ready merely because its routes compile.
