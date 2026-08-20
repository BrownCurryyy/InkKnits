# InkKnits Architecture and Workflow Audit

Date: 2026-08-19
Scope: information architecture, workflow, RBAC/station access, AI jobs, atomization, version bundling, ComfyUI integration, and frontend/backend contract alignment.

## 1. Current Frontend Structure

The active entrypoint is `frontend/src/main.tsx`, which renders the TypeScript `App.tsx`. The active route set contains organization, projects, stations, assets, approvals, AI, and activity. The main feature surfaces are `Dashboard`, `OrganizationPage`, `ProjectPage`, `StationPage`, `AssetWorkspace`, `AssetDetail`, `ApprovalsQueue`, `AIJobConsole`, and `ActivityPage`.

Shared infrastructure exists in `api/client.ts`, `context/AuthContext.tsx`, `types.ts`, `ProtectedRoute.tsx`, and `AppShell.tsx`. However, legacy duplicate entrypoints remain in `main.jsx` and `App.jsx`; they are not the active TypeScript path and should be removed or archived after a clean migration.

The shell now exposes a left sidebar. Station destinations come from the scoped `/stations` response, organization management is shown only for ADMIN/MANAGER roles, and approvals are shown only for review-capable roles. Feature pages still contain some broad collection fetches and client-side filtering. `AIJobConsole` now monitors the durable centralized `/ai/jobs` list and polls individual visible jobs; contextual Asset Detail actions remain submission origins. The frontend currently stores access and refresh tokens in localStorage.

## 2. Current User Workflow

1. Login obtains JWT access and refresh tokens; `/auth/me` hydrates the user.
2. The shell loads organizations, projects, stations, assets, approvals, AI jobs, and activities through feature components.
3. The employee selects a project/station and browses assets.
4. Asset detail supports content editing, upload, version browsing/restoration, approval submission, and contextual AI actions.
5. Approvals are monitored in a separate queue and can be approved, rejected, commented on, or escalated.
6. AI jobs are submitted and polled from a separate console.

This workflow is functionally broad. Backend project, station, asset, version, activity, approval, and AI visibility now respects organization and station membership in the audited routes. Home remains close to a duplicate dashboard rather than a focused “what do I need to work on?” workspace. AI is now a centralized durable queue surface, but some results/errors are not durably persisted.

## 3. Current RBAC Flow

JWT claims contain `organization_id` and role names. `get_user_roles()` joins user roles to roles by user ID. `has_required_roles()` recognizes role names and grants ADMIN an override. FastAPI routes use `require_roles()` only on selected write endpoints.

The database contains ADMIN, MANAGER, EDITOR, REVIEWER, PUBLISHER, and VIEWER roles. The backend now applies role-specific guards: ADMIN organization-wide override, MANAGER organization/project/station/approval management, EDITOR production/AI operations, REVIEWER assigned approval decisions, PUBLISHER no-op read access because no publishing route exists, and VIEWER read-only access. Station membership is modeled by `station_members` and is enforced by the audited production/workflow routes. Project membership is not represented by a dedicated model in the current inspected schema.

The documented permission engine is not active: Permission and RolePermission records are not consulted by authorization guards. Backend authorization is therefore role-name based and inconsistently resource scoped.

## 4. Current AI Flow

`POST /ai/jobs` creates a durable `AIJob` and submits the task to the in-memory priority scheduler. The scheduler uses priority 1 for lightweight text operations and priority 2 for image work, with one worker/GPU slot. Text work calls Ollama. Image work enriches the user prompt with Ollama, submits a runtime-built ComfyUI graph, polls history, stores the output, and creates an image asset. Atomization creates child assets and AssetLink rows.

`POST /ai/jobs` is the single submission path used by contextual AI callers. It creates one durable `AIJob` and submits the same task ID to the in-memory priority scheduler. `GET /ai/jobs` returns the scoped durable queue with job, project/station/asset, requester, priority, position, lifecycle timestamps, result availability, result data, and failure details. `GET /ai/jobs/{task_id}` applies the same visibility rules and falls back to durable result/error data after scheduler memory is gone. Completed text results and failures are persisted in `result_data` and `error`. Cancellation remains an internal scheduler operation only: there is no authenticated API endpoint, and running external Ollama/ComfyUI calls cannot be safely interrupted. UPSCALE is a placeholder.

## 5. Current ComfyUI Flow

The runtime now loads `backend/final4.json` as its single API-format workflow, injects the Gemma-enriched prompt into node `6`, request dimensions into node `5`, checkpoint into node `4`, deterministic seeds into nodes `3` and `20`, and uses node `9` as the SaveImage output. It submits `/prompt`, polls `/history/{prompt_id}`, requests output through `/view`, and writes output to SSD.

`backend/final4.json` is now the runtime graph rather than a separate illustrative graph. ComfyUI node availability and the declared checkpoint were verified through `/object_info`; Ollama `gemma2:2b` and ComfyUI `/system_stats` were reachable. A real authenticated IMAGE job completed through enrichment, `final4` submission, execution/history/output extraction, SSD storage, asset creation, version snapshot, activity logging, and AI job completion.

## 6. Identified Architectural Problems

- Audited project, station, asset, version, activity, approval, and AI list/detail paths now restrict records to the authenticated organization and station memberships where a station relationship exists.
- Authenticated regression coverage now includes same-organization, cross-organization, station-member, non-member, ADMIN, VIEWER, and forged-identity cases.
- Several create/update APIs accept organization, owner, creator, station, or project identifiers from the client rather than deriving or validating them.
- Project, station, asset, approval, and AI route scope checks were added; project deletion’s missing datetime import was corrected.
- Station `color` and `icon` were removed from the API/frontend contract because the model does not define them.
- Approval reads/actions now verify organization, station, and assignment scope.
- AI polling and queue listing now verify organization/station visibility and expose durable result/error state.
- The frontend hides controls but cannot substitute for backend authorization.
- `AIJobConsole` now monitors the durable centralized queue through `GET /ai/jobs`; generic queue submission was removed so the queue remains a monitoring surface.
- Normal AI-generated assets do not consistently receive initial version snapshots or creation activity events.
- Atomization has storage support but no dedicated lineage API/view.
- No implemented project-level content version bundle model or API was found.
- Storage paths are too trusted; client-controlled paths create an arbitrary-file-read risk in download flows.
- `final4.json` is now the single runtime workflow contract and has passed one real image-job trace.
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
| Projects | CRUD mostly present | scoped reads/writes added; no project-membership model |
| Stations | CRUD/member/dashboard partial | membership-scoped reads/writes added; no project-member model |
| Assets | CRUD/upload/search/download/version hooks | changed production paths are scoped; storage/path hardening remains |
| Versions | list/create/restore | no route scope; generated assets may miss snapshots |
| Activities | read/create/logging | global reads and caller-controlled event identity |
| Approvals | create/list/approve/reject/comment/escalate | assignment/tenant/station scope implemented; no reassign route |
| AI jobs | submit/status/list/scheduler | durable result/error fields added; no authenticated cancellation API; UPSCALE remains placeholder |
| Atomization | scheduler creates child assets and links | no dedicated API/lineage view; incomplete snapshot/activity guarantees |
| Permissions | tables/models exist | permissions are not seeded or enforced |
| Content version bundle | no inspected model/router | backend capability gap |
| ComfyUI | runtime prompt/history/view/storage | does not execute or validate `final4.json`; no live proof |
| Tests | hardening/regression/unit coverage | lacks authenticated isolation and end-to-end AI tests |

## 11. RBAC Gaps

- Role names are implemented, but permission records/mappings are not authoritative.
- ADMIN override exists; MANAGER, REVIEWER, PUBLISHER semantics are not consistently applied by routers.
- Station membership is enforced on the audited project/station/asset/version/AI/approval routes.
- Organization isolation is enforced on the audited organization/project/station/asset/version/activity/approval/AI routes.
- `get_user_roles()` now constrains role lookup by the user organization.
- Frontend role checks remain UX-only; backend authorization is authoritative.

## 12. Backend Gaps

- No project membership model/API was confirmed, so exact project assignment cannot be implemented without adapting to the schema.
- No content version bundle model/API was found.
- AI list endpoint now exists with durable result/error/context fields; no authenticated cancellation endpoint exists. Live PostgreSQL is at migration head `20260820_ai_job_persistence`.
- Asset and project lineage read endpoints now exist using the existing `asset_links` table; no graph database or new relationship table was added.
- No verified publication endpoint was found.
- Permission tables exist, but no complete permissions seed/enforcement path was found; route authorization remains role-name based.
- Deterministic six-user organization seed exists in `backend/scripts/local_dev_setup.py`; it uses `*@example.com` demo users and the development-only password `InkKnits-Dev-2026!`. It creates 3 projects, 10 stations, 8 assets, 8 initial versions, and 2 approval tasks, with no queued AI jobs.
- The API contract base path and runtime root path disagree.

## 13. ComfyUI Diagnostic Result

**PASS for the current-source trace.** `final4.json` loaded successfully; required nodes and checkpoint were available; Ollama enrichment succeeded; ComfyUI `/prompt`, execution, `/history`, output extraction, SSD storage, generated asset creation, version/activity creation, and AI job completion all succeeded. The real trace produced task `8bcb0620-d587-4a64-980f-a5b06cd89d6d` and generated asset `9dc62271-a471-4411-a527-ff2333be004d`. An earlier trace against a stale process on port 8000 remained RUNNING and is not representative of the current source.

## 14. Content Atomization Flow

Current backend path: submit an ATOMIZATION job with source asset/content -> scheduler invokes Ollama -> parse generated outputs -> create independent child Assets -> create AssetLink records -> create one initial Version snapshot per child -> log `ASSET_CREATED` and `ATOMIZED` activities per child. The parent is never updated. Read-only lineage is exposed through `GET /assets/{asset_id}/lineage` and `GET /projects/{project_id}/lineage`, scoped by organization and station membership.

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

## Validation Status After Changes

- Frontend TypeScript/Vite production build passes.
- Backend test suite passes (`22 passed`), including authorization, seed, scheduler priority/cancellation, atomization child materialization, lineage links, snapshots, activities, and lineage access control.
- Changed backend modules and deterministic seed compile successfully.
- Backend imports successfully from the repository root; package-qualified imports still require that launch context.
- ComfyUI image generation was executed end-to-end in a separate current-source trace; atomization uses the same centralized AI scheduler path.
- Deterministic six-user seed executed successfully against local PostgreSQL twice with identical counts, proving live idempotency.
- Station-scoped visibility is implemented for the changed production/workflow routes and covered by focused SQLite authorization tests.
