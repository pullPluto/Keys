# ADR-005: HR requests require SysAdmin approval before activation

**Status:** Accepted for incubation
**Decision:** A People Manage/HR workflow submits requested access into a provisioning queue. Only a qualifying SysAdmin approval may activate a user; self-approval is prohibited.

## Consequences

This preserves HR input while preventing an HR integration from becoming an unrestricted account-creation authority. It adds queue operations, segregation-of-duties rules, audit obligations, and a potential provisioning delay that needs an agreed service model.
