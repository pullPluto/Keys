# Enterprise security baseline

Keys must use phishing-resistant MFA for privileged administrators, least-privilege roles, separate environments, short-lived deployment credentials, managed secret bindings, strict HTTPS-only redirects, rate limiting, WAF/abuse controls, log minimization, audit review, dependency scanning, incident response, and tested recovery.

The initial role model reserves `SysAdmin` for privileged user/app/policy administration and `People Manage` for HR-related request submission. A People Manage request is always pending until an eligible SysAdmin reviews it. Elevated access requires two-person control; an identity cannot approve its own provisioning, elevation, or application-owner change.

This baseline is a design requirement, not evidence that controls are deployed. Every production control needs configuration, an owner, a test, and ongoing review before it can be claimed effective.
