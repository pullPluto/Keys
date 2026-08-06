# Threat detection and machine learning

Keys will use layered prevention first: phishing-resistant MFA, least privilege, precise redirect URIs, rate limits, short-lived tokens, segregation of duties, audit trails, anomaly-safe alerts, and explicit incident response. Machine learning may assist detection; it must not silently grant access, modify roles, revoke accounts, or block a critical administrator without deterministic policy and a human-review path.

Candidate signals include impossible travel, unusual sign-in velocity, new device patterns, repeated MFA failures, suspicious role changes, abnormal application registration, token replay indicators, and anomalous provisioning requests. Before collecting any signal, define the data fields, privacy basis, retention, false-positive handling, model owner, drift monitoring, security of model inputs, and appeal/override process. No threat-detection model is implemented or approved yet.
