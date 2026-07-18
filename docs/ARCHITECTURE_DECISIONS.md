ADR-001

Decision

Use FastAPI instead of Express.

Reason

Native asyncio support.

--------------------------------

ADR-002

Decision

Use PostgreSQL.

Reason

Relational data for RBAC.

--------------------------------

ADR-003

Decision

No Redis. No Celery.

Reason

Single GPU architecture.

--------------------------------

ADR-004

Decision

Priority Queue.

Reason

Text jobs should not wait behind images.

--------------------------------

ADR-005

Decision

Version Tracking instead of Version Control.

Reason

Project stores snapshots, not Git branches.