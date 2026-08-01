# Frontend Directives

## Goal
Use this guide to build the frontend so it works cleanly with the current backend contract and the project architecture.

## Application Structure
- Keep the app split by feature: auth, organizations, projects, stations, assets, approvals, AI jobs, and activity.
- Put shared UI primitives in a reusable components layer.
- Keep API access behind a single client module so route changes are isolated.

## Authentication Flow
- Store the access token in memory or a secure client-side store.
- Attach the token to every protected request through the Authorization header.
- Redirect users to login when a 401 response is returned.
- Use the /auth/me endpoint to hydrate the current user profile after sign-in.

## Role-Based UI
- Respect role-based permissions in the UI.
- Hide or disable admin-only actions unless the current user has ADMIN or MANAGER access.
- Show clear empty or disabled states for restricted actions.

## Data Fetching Rules
- Prefer a shared API client with typed request/response models.
- Use optimistic updates carefully for asset edits and approvals.
- Refresh relevant views after create, update, approve, reject, and restore actions.

## Asset Experience
- Show preview, metadata, version history, and activity history for each asset.
- Use the upload endpoint for file transfers and surface validation feedback for file type and size errors.
- Distinguish between text assets and file assets in the UI.

## Activity & Versioning
- Render an activity timeline for key actions such as create, update, restore, approve, and AI job submission.
- Add a version browser so users can inspect snapshots and restore previous versions.

## Approval & AI Queue UX
- Provide a dashboard for approval tasks with status chips and deadline warnings.
- Show AI job queue status, estimated position, and cancellation controls where appropriate.

## Error Handling
- Surface backend errors in user-facing toasts or inline notices.
- Keep validation messages close to the affected form field.
- Handle loading, empty, and failure states consistently.

## Environment Configuration
- Keep base URLs, API timeout settings, and feature flags in environment variables.
- Avoid hardcoding secrets or organization IDs in the frontend bundle.
