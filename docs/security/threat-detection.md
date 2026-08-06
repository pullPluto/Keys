# Threat detection and machine learning

Keys will use layered prevention first: phishing-resistant MFA, least privilege, precise redirect URIs, rate limits, short-lived tokens, segregation of duties, audit trails, anomaly-safe alerts, and explicit incident response. Machine learning may assist detection; it must not silently grant access, modify roles, revoke accounts, or block a critical administrator without deterministic policy and a human-review path. This is captured in [ADR-008](../decisions/ADR-008-layered-threat-detection.md).

Candidate signals include impossible travel, unusual sign-in velocity, new device patterns, repeated MFA failures, suspicious role changes, abnormal application registration, token replay indicators, and anomalous provisioning requests. Before collecting any signal, define the data fields, privacy basis, retention, false-positive handling, model owner, drift monitoring, security of model inputs, and appeal/override process. No threat-detection model is implemented or approved yet.

The MVP does not collect any of these signals. The threat model that
will gate production deployment is broken into four Phase 4 issues in
[`../decisions/backlog/mvp.md`](../decisions/backlog/mvp.md):

- 4.3a — assets inventory (data, components, owners);
- 4.3b — adversary and attack surface list (threat IDs);
- 4.3c — mitigation mapping (existing control + gap for each threat);
- 4.3d — incident response runbook (severity, on-call, comms).

Each of those issues lands before any production deployment, and the
threat model document is required reading before any new domain
package is added.
