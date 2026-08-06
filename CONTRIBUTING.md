# Contributing to Keys

Create focused changes with an issue or decision context. Read `AGENTS.md` and the affected documentation before editing. Keep pull requests small, add tests for observable behavior, and include migration/recovery notes for storage changes.

Run `npm run typecheck` and `npm test` before requesting review. A security-sensitive change requires review by the designated security owner; deployment and operational changes require the eventual service owner. Neither owner is currently assigned in this repository.

Do not add secrets or production identifiers. Use inert examples and the checked-in Wrangler template only.
