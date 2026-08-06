# Provisioning package

Contracts for HR-originated and manual requests that await SysAdmin decision. A request never creates an active account by itself. Concrete adapters must reject self-approval and record an audit event for every decision.
