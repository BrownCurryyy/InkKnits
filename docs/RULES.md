# Core System Rules

---

# 1. Architecture & Design Principles

- Never duplicate business logic.
- No raw SQL outside Repository classes.
- React must never communicate directly with Ollama or ComfyUI.
- React must never wait on long-running HTTP requests; all AI operations use asynchronous job polling.
- Business logic belongs only in the backend service layer.
- Every subsystem must have a single responsibility.
- Configuration values must be loaded only from `.env` files.

---

# 2. Security & Authentication

- Never bypass RBAC permission checks.
- Every protected API endpoint must validate JWT authentication.
- JWT tokens expire after **1 hour**.
- User permissions and role metadata are embedded inside JWT claims to minimize unnecessary database lookups.
- Passwords must always be securely hashed using `bcrypt`.
- Sensitive secrets must never be committed to source control.

---

# 3. Organization Hierarchy

Every entity follows the hierarchy below.

```
Organization
    └── Project
            └── Station
                    └── Asset
```

Rules:

- Every Asset belongs to exactly one Station.
- Every Station belongs to exactly one Project.
- Every Project belongs to exactly one Organization.
- Stations define functional production areas.
- Stations own Assets.
- Stations contain Members.
- Stations expose Permissions.
- Stations are independent of user Roles.

---

# 4. Assets

- Everything is an Asset.
- Assets may represent text, images, generated media, prompts or derived content.
- Assets are never permanently deleted.
- Assets always use soft deletion.

---

# 5. Version Tracking

This project implements **Version Tracking**, not traditional Version Control.

Rules:

- Every asset modification creates a new Version Tracking entry.
- Version Tracking is append-only.
- Previous versions are immutable.
- Version Tracking stores complete snapshots rather than text diffs.
- Existing versions are never overwritten.
- Version Tracking exists independently from Activity Logs.

---

# 6. Activity Service

The Activity Service provides the platform audit trail.

Rules:

- Activity logs are immutable.
- Activities record user and system events only.
- Activities never store asset contents.
- Activities are append-only.
- Activities record actions such as:

    - Login
    - Logout
    - Asset Creation
    - Asset Update
    - Asset Open
    - AI Generation
    - Image Generation
    - Approval
    - Publication
    - Assignment
    - Escalation
    - Deletion
    - Restore

---

# 7. AI Job System

Every AI operation is treated as an asynchronous Job.

Rules:

- Every AI request creates exactly one Job.
- Jobs are immutable after creation.
- Every Job immediately returns a `task_id`.
- Every Job enters the Priority Scheduler.
- A user may only have one active AI Job unless explicitly permitted.
- Text-generation Jobs always have higher priority than image-generation Jobs.
- Prompt enrichment must complete before image generation begins.
- Image generation always executes through ComfyUI.
- Prompt enrichment always executes through Gemma.

---

# 8. Queue & Scheduling

- The system uses an in-memory `asyncio.PriorityQueue`.
- The scheduler always executes the highest-priority pending Job.
- Background GPU concurrency is permanently locked to **1**.
- The scheduler must prevent VRAM over-allocation and Out-of-Memory (OOM) failures.
- Long-running Jobs never block the API server.
- Clients receive live Job status through polling.

Priority Order:

```
1. Text Generation
2. Summarization
3. Expansion
4. Content Atomization
5. Image Generation
6. Image Upscaling
```

---

# 9. AI Pipeline

## Text Pipeline

```
User Prompt
        ↓
FastAPI
        ↓
Job Queue
        ↓
Gemma
        ↓
Response
        ↓
Database
```

## Image Pipeline

```
User Prompt
        ↓
Gemma Prompt Enrichment
        ↓
Job Queue
        ↓
ComfyUI
        ↓
Base64 Encoding
        ↓
Frontend
```

---

# 10. Storage

- PostgreSQL stores metadata only.
- PostgreSQL never stores raw binary media.
- Images are stored locally on SSD.
- Database records store only image file paths.
- Images returned to the frontend are encoded as Base64 JSON responses.
- ComfyUI temporary folders must be cleaned automatically.
- Generated outputs are stored inside structured storage directories.

---

# 11. Database Standards

- Every table uses UUID primary keys.
- Every entity includes:

    - created_at
    - updated_at
    - deleted_at

- Soft deletion always uses `deleted_at`.
- Foreign key relationships must enforce organizational hierarchy.
- Database migrations are managed through Alembic.

---

# 12. API Standards

- Every request is validated.
- Every response follows a standard JSON schema.
- Long-running operations return `task_id` immediately.
- Polling endpoints return Job progress and queue position.
- API routes never expose internal implementation details.

---

# 13. Coding Standards

- Use `snake_case` for Python modules, functions and variables.
- Use `PascalCase` for classes and React components.
- Use `UPPER_CASE` for constants and enums.
- Keep services independent and loosely coupled.
- Never hardcode secrets.
- Never duplicate code.

---

# 14. Future Scalability

The current implementation targets a single-machine deployment.

Future upgrades may include:

- Redis
- Celery
- Distributed Workers
- Multi-GPU Scheduling
- Cloud Object Storage
- WebSockets
- Multi-LLM Support

## Non-Negotiable Principles

1. Everything is an Asset.
2. Every AI action becomes a Job.
3. Every Asset modification creates a Version Tracking entry.
4. Activity Logs are immutable.
5. React never communicates directly with AI models.
6. GPU concurrency is permanently limited to one active generation.
7. RBAC is enforced server-side only.
8. Organization → Project → Station → Asset is the only valid hierarchy.