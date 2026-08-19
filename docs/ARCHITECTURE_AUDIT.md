# InkKnits Architecture and Workflow Audit

Date: 2026-08-19
Scope: information architecture, workflow, RBAC/station access, AI jobs, atomization, version bundling, ComfyUI integration, and frontend/backend contract alignment.

## 1. Current Frontend Structure

The active entrypoint is `frontend/src/main.tsx`, which renders the TypeScript `App.tsx`. The active route set contains organization, projects, stations, assets, approvals, AI, and activity. The main feature surfaces are `Dashboard`, `OrganizationPage`, `ProjectPage`, `StationPage`, `AssetWorkspace`, `AssetDetail`, `ApprovalsQueue`, `AIJobConsole`, and `ActivityPage`.

Shared infrastructure exists in `api/client.ts`, `context/AuthContext.tsx`, `types.ts`, `ProtectedRoute.tsx`, and `AppShell.tsx`. However, legacy duplicate entrypoints remain in `main.jsx` and `App.jsx`; they are not the active TypeScript path and should be removed or archived after a clean migration.

The current shell is a header with grouped horizontal navigation. It fetches all stations and renders them as navigation items. Feature pages commonly fetch broad collections and filter them in React. `AIJobConsole` does not load pre-existing jobs because its `loadJobs` implementation is empty. The frontend currently stores access and refresh tokens in localStorage.

## 2. Current User Workflow

1. Login obtains JWT access and refresh tokens; `/auth/me` hydrates the user.
2. The shell loads organizations, projects, stations, assets, approvals, AI jobs, and activities through feature components.
3. The employee selects a project/station and browses assets.
4. Asset detail supports content editing, upload, version browsing/restoration, approval submission, and contextual AI actions.
5. Approvals are monitored in a separate queue and can be approved, rejected, commented on, or escalated.
6. AI jobs are submitted and polled from a separate console.

This workflow is functionally broad but not safely scoped. The employee experience is organized around global collections rather than the Organization -> Project -> Station -> Asset hierarchy. Home is close to a duplicate dashboard rather than a focused “what do I need to work on?” workspace. AI is not yet a reliable centralized queue because existing jobs are not loaded and some results are not durably persisted.

## 3. Current RBAC Flow

JWT claims contain `organization_id` and role names. `get_user_roles()` joins user roles to roles by user ID. `has_required_roles()` recognizes role names and grants ADMIN an override. FastAPI routes use `require_roles()` only on selected write endpoints.

The database contains ADMIN, MANAGER, EDITOR, REVIEWER, PUBLISHER, and VIEWER roles. The frontend mostly checks only ADMIN and EDITOR. Station membership is modeled by `station_members`, but route-level reads and writes do not consistently enforce membership. Project membership is not represented by a dedicated model in the current inspected schema.

The documented permission engine is not active: Permission and RolePermission records are not consulted by authorization guards. Backend authorization is therefore role-name based and inconsistently resource scoped.

## 4. Current AI Flow

`POST /ai/jobs` creates a durable `AIJob` and submits the task to the in-memory priority scheduler. The scheduler uses priority 1 for lightweight text operations and priority 2 for image work, with one worker/GPU slot. Text work calls Ollama. Image work enriches the user prompt with Ollama, submits a runtime-built ComfyUI graph, polls history, stores the output, and creates an image asset. Atomization creates child assets and AssetLink rows.

`GET /ai/jobs/{task_id}` returns status for a known task ID. There is no list endpoint, so the centralized queue cannot reconstruct existing jobs after navigation or restart. Completed text results and failure details are not consistently persisted to the durable job row. Cancellation is incomplete: a queued or running task can continue because execution does not reliably re-check cancellation state. UPSCALE is a placeholder.

## 5. Current ComfyUI Flow

The runtime requests `/prompt`, polls `/history/{prompt_id}`, requests output through `/view`, and writes output to SSD. The runtime builds its own API-format graph in `comfyui_service.py`.

`backend/final4.json` is a separate graph containing latent/upscaling nodes and a different topology/checkpoint from the runtime graph. The runtime does not load, validate, or execute `final4.json`. Therefore the documented `test2 -> final4` path has not been proven end-to-end by the current code. No live trace was possible in this audit because ComfyUI/Ollama/PostgreSQL availability and credentials were not verified.

## 6. Identified Architectural Problems

- Global backend list/detail routes do not consistently restrict records to the authenticated organization.
- Station membership exists but is not used as a general read/write scope.
- Several create/update APIs accept organization, owner, creator, station, or project identifiers from the client rather than deriving or validating them.
- Projects have no role or organization checks; project deletion also references `datetime` without importing it.
- Stations pass `color` and `icon` although the inspected Station model does not define those fields.
- Approval reads/actions do not verify organization, station, or assignment scope.
- AI polling accepts any authenticated user who knows a task ID.
- The frontend hides controls but cannot substitute for backend authorization.
- `AIJobConsole.loadJobs()` is empty; the centralized queue is therefore incomplete.
- Normal AI-generated assets do not consistently receive initial version snapshots or creation activity events.
- Atomization has storage support but no dedicated lineage API/view.
- No implemented project-level content version bundle model or API was found.
- Storage paths are too trusted; client-controlled paths create an arbitrary-file-read risk in download flows.
- `final4.json` and the runtime ComfyUI graph are not one verified workflow contract.
- `main.jsx`/`App.jsx` duplicate the active TypeScript entrypoints and include stale API behavior.
- The written API contract says `/api`, while the running FastAPI app exposes root routes.
- A `docs/progress.md` file requested by the brief does not exist.

## 7. Proposed Information Architecture

Use a left sidebar with server-derived destinations:

- HOME: Home, My Projects
- ORGANIZATION: Organization, People, Projects, Stations, visible only to authorized organization managers/admins
- STATIONS: only stations returned for the current user; ADMIN can see organization-wide stations
- WORKFLOW: Approvals, AI Queue, Activity, each backed by scoped endpoints

Use a project workspace for campaign state and a station workspace for production work. Keep asset detail focused on content, Info, Versions, Activity, contextual approval, and contextual AI actions. Do not make metadata a primary destination.

## 8. Proposed Employee Workflow

Login -> Home -> assigned project/station -> asset workspace -> contextual editing or AI action -> asynchronous AI Job -> centralized AI Queue -> result becomes an Asset or explicit user-applied content -> version snapshot -> approval -> publish/review workflow.

Home answers “what do I need to work on?” with assigned stations/projects, recent assets, pending approvals, active jobs, and recent scoped activity. It does not duplicate the full project dashboard.

## 9. Proposed Admin Workflow

Login -> Organization overview -> People/roles/station membership -> Projects -> Stations -> scoped production views. ADMIN receives organization-wide authority through backend guards and can manage structure/memberships where the implementation supports it. The frontend must reflect permissions but the backend remains authoritative.

## 10. Backend Capability Matrix

| Area | Current state | Gap |
|---|---|---|
| Auth/JWT | Implemented | status/deleted-user checks and package startup consistency need verification |
| Organizations | CRUD/member routes partial | global reads and weak cross-org checks |
| Projects | CRUD mostly present | no scoped RBAC; delete missing datetime import |
| Stations | CRUD/member/dashboard partial | model/router field mismatch; no membership enforcement |
| Assets | CRUD/upload/search/download/version hooks | global reads; client-controlled tenant/path fields |
| Versions | list/create/restore | no route scope; generated assets may miss snapshots |
| Activities | read/create/logging | global reads and caller-controlled event identity |
| Approvals | create/list/approve/reject/comment/escalate | no assignment/tenant/station scope; no reassign route |
| AI jobs | submit/status/scheduler | no list/cancel API; incomplete durable result/error persistence |
| Atomization | scheduler creates child assets and links | no dedicated API/lineage view; incomplete snapshot/activity guarantees |
| Permissions | tables/models exist | permissions are not seeded or enforced |
| Content version bundle | no inspected model/router | backend capability gap |
| ComfyUI | runtime prompt/history/view/storage | does not execute or validate `final4.json`; no live proof |
| Tests | hardening/regression/unit coverage | lacks authenticated isolation and end-to-end AI tests |

## 11. RBAC Gaps

- Role names are implemented, but permission records/mappings are not authoritative.
- ADMIN override exists; MANAGER, REVIEWER, PUBLISHER semantics are not consistently applied by routers.
- Station membership is not enforced on list/detail/asset/AI/approval routes.
- Organization isolation is not enforced consistently.
- `get_user_roles()` does not constrain role lookup by the user organization.
- Frontend role checks only partially reflect the backend role set and cannot enforce access.

## 12. Backend Gaps

- No project membership model/API was confirmed, so exact project assignment cannot be implemented without adapting to the schema.
- No content version bundle model/API was found.
- No AI list/cancellation endpoint was found.
- No dedicated asset lineage endpoint was found.
- No verified publication endpoint was found.
- No complete permissions seed/enforcement path was found.
- No deterministic six-user organization seed exists; current setup creates one admin, one project, one station, and `admin@example.com/password123`.
- The API contract base path and runtime root path disagree.

## 13. ComfyUI Diagnostic Result

The workflow file is API-shaped JSON, but the running service does not consume it. The exact runtime graph is built in Python and uses different nodes/model assumptions. A real image job could not be traced in this environment, so the required end-to-end result is **not proven**. The failure boundary to resolve is workflow selection/validation before `/prompt`, followed by actual ComfyUI availability and history/output extraction.

## 14. Content Atomization Flow

Current backend path: submit an ATOMIZATION job with source asset/content -> scheduler invokes Ollama -> parse generated outputs -> create independent child Assets -> create AssetLink records. Required follow-up: expose an explicit station-context action, preserve parent without overwrite, create snapshots/activity for every child, and add a lineage read endpoint/view. No fabricated endpoint should be added until the service contract is formalized.

## 15. Project Version Bundle Flow

Required flow: project -> related assets -> active latest version per asset -> assembled production-state view. Current schema supports assets and versions but no explicit bundle entity or endpoint. This is a backend capability gap; the frontend can only show an interim latest-version grouping until a server contract exists.

## 16. Files to Create

- `docs/ARCHITECTURE_AUDIT.md` (this audit)
- A scoped backend authorization helper module if existing repository patterns cannot provide it
- A deterministic seed fixture/script extension
- A central frontend workspace/navigation model if the current shell is retained
- Later: explicit AI list/cancel and lineage/bundle API contracts and tests

## 17. Files to Modify

First implementation order:

- `backend/app/auth.py`
- `backend/app/routers/projects.py`
- `backend/app/routers/stations.py`
- `backend/app/routers/assets.py`
- `backend/app/routers/organizations.py`
- `backend/app/routers/approvals.py`
- `backend/app/routers/versions.py`
- `backend/app/routers/activities.py`
- `backend/app/routers/ai.py`
- `backend/scripts/local_dev_setup.py`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/AIJobConsole.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/context/AuthContext.tsx`
- focused backend tests

## 18. Files to Remove or Merge

After confirming the TypeScript entrypoint is the only supported frontend entrypoint, remove or archive `frontend/src/main.jsx` and `frontend/src/App.jsx`. Merge duplicate dashboard/asset surfaces only after route usage is confirmed. Do not remove `Dashboard` until its Home replacement is implemented.

## 19. Implementation Order

1. Establish backend startup/import consistency and scoped authorization helpers.
2. Correct project/station/asset/approval/AI organization and station scope.
3. Correct deterministic development seed and document limitations.
4. Add AI list/cancel/result persistence only where compatible with current models.
5. Replace global frontend navigation with scoped sidebar destinations.
6. Make Home assignment-focused and keep Project/Station/Asset pages distinct.
7. Add explicit atomization and lineage UX against real backend contracts.
8. Add bundle representation after a backend contract exists.
9. Validate TypeScript, frontend build, backend tests, and live service prerequisites.

## Validation Status Before Changes

- Frontend production build previously passed after the workflow components were added.
- Backend startup from `backend/` currently fails because imports use `backend.*`; startup from the repository root is the supported workaround until imports/launch documentation are aligned.
- ComfyUI image generation was not executed end-to-end in this audit.
- Deterministic six-user seed is not yet implemented.
- Station-scoped visibility is not yet guaranteed by the backend.
