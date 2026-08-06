# Mission Control integration boundary

Mission Control is a separate downloadable desktop application. Keys is its identity, authorization, application-tile, project-assignment, action-policy, artifact-authorization, and presence authority. Mission Control is responsible for its UI, local terminal, device detection, local dependency installation, package execution, app lock, and user-visible update notices.

## Keys provides

- authenticated user, group, role, project-assignment, and device-session claims;
- filtered application tiles, shortcut links, icons, and SSO launch metadata;
- action manifests: identifier, version, signature, integrity hash, allowed projects/roles/devices, declared capabilities, dependency profile, and artifact reference;
- short-lived authorization to download an approved R2 icon or action artifact;
- accepted action-result, device-posture, presence, and clock-session events.

## Keys must not provide

Desktop scripts, a terminal implementation, local passcode handling, screen-capture implementation, raw device telemetry, browser-history content, screenshot content, or vault plaintext. Those belong in Mission Control or a separate approved service.

## Contract requirements

Mission Control authenticates through an OIDC client registration and proves a registered device session. It treats every manifest and artifact as untrusted until signature and hash verification succeed. It uses an idempotency key for event delivery and never sends credentials, raw terminal input/output, screenshots, mouse events, or browsing content as normal telemetry. The HTTP schema and signing format are **TBD** until Keys' OIDC issuer and service API are implemented.
