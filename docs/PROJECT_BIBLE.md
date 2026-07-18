# 📖 PROJECT BIBLE: Enterprise AI Content Production Platform

> **Version**: 1.0  
> **Status**: Approved Blueprint  
> **Target Deploy Hardware**: HP Omen Laptop (6GB RTX 4050 VRAM, 16GB System RAM)

---

## 1. Vision
We are building an AI-assisted enterprise content production platform that centralizes content creation, generation, review, approval, and publishing into a single workflow. The platform combines local AI inference, structured collaboration, immutable history tracking, and intelligent task scheduling to provide a complete production environment deployable on a single machine.

## 2. Problem Statement
Modern content creation workflows are fragmented and fragile. Teams rely on a disconnected mess of platforms: Slack for coordination, Google Docs for editing, Midjourney for visuals, emails for approvals, and local hard drives for storage. This fragmentation leads to:
* Loss of data context and absolute chaos regarding asset version histories.
* Zero auditing trail showing who modified what, when, and with what AI inputs.
* Massive system crashes and resource contention when multiple local users try to run AI processes simultaneously on resource-constrained host hardware.
Existing AI tools solve isolated generation problems, but not the operational workflow surrounding collaborative content production.

## 3. Goals
The platform resolves these workflow gaps through the following operational goals:  
* **Centralize Content Production**: Houses all multi-format assets within structured, role-guarded team workspaces.
* **Remove Disconnected Tools**: Integrates ideation, composition, rendering, auditing, and reviews into a single system.
* **Integrate AI Safely**: Incorporates local LLM (Ollama) and Image Diffusion (ComfyUI) engines directly into the creation flow.
* **Improve Approvals**: Enforces linear review chains with active deadline tracking and auto-escalation paths.
* **Track History**: Ledger-records every single content state modification, preventing any data overwriting.
* **Maintain Local-First Infrastructure**: Run entirely on commodity hardware without mandatory cloud dependencies.

## 4. Non-Goals
To prevent devastating feature creep, the following targets are strictly out of scope:
* **Not Google Docs**: It is a content pipeline manager, not a real-time multiplayer markdown word processor.
* **Not GitHub**: It tracks linear structural snapshots, not branch merges, merge conflicts, or repository forks.
* **Not Canva / Photoshop**: It manages the generation and metadata of visual layers; it provides no raw graphical canvas editing
tools.
* **Not Jira**: It manages asset state workflows, not complex agile software sprints or sprint velocity telemetry tracking.

## 5. Core Philosophy
Six absolute truths influence every code design decision in this repository:
* **Everything is an Asset**: Texts, graphics, and social copy are managed identically by the core architecture.
* **Everything AI Does Becomes a Job**: All AI compute loads are wrapped in structured states and enqueued.
* **Nothing Important is Ever Deleted**: All removals use safe soft-delete hooks to preserve historic project records.
* **History is Never Rewritten**: The version log ledger is strictly append-only.
* **Every Organization Owns Its Data**: Organizations retain complete ownership of their data through a local-first architecture that minimizes external cloud dependencies.
* **AI Assists Humans, Never Replaces Approval**: AI speeds up execution, but human oversight holds final publishing authority.

## 6. User Journey
The operational domain model follows a strict multi-tenant cascade:

Organization (The institutional boundary)
↓
Project (The macro production campaign)
↓
Station (Functional production area workspaces)
↓
Asset (The text/image/media layer)
↓
AI (Text enrichment, image generation, upscaling)
↓
Review (Approval, rejection, or supervisor escalation)
↓
Publish (Final archival readiness state)

## 7. Major Components
* **Organization System**: The high-level isolation partition separating organizational domains, permissions, and tenant access rules.
* **RBAC**: Implements strict access guards (`ADMIN`, `EDITOR`, `VIEWER`), verified using stateless JWT claims.
* **Stations**: Segregated functional production swimlanes (e.g., Writing, Graphics) that organize assets and team assignments.
* **Assets**: The universal data model storing textual blocks, local SSD storage file paths, and flexible meta JSON blocks.
* **AI**: Integrated local intelligence utilities executing generative text expansions and image diffusion rendering blocks.
* **Scheduler**: The priority queue worker managing compute-heavy jobs sequentially to prevent server crashes.
* **Version Tracking**: An immutable ledger capturing complete asset state snapshots on every modification.
* **Activity Service**: An append-only audit trail logging user interactions (e.g., logins, generation, deletions).
* **Approval Workflow**: A linear validation loop connecting creators with reviewers under strict completion deadlines.
* **Auto-Escalation**: A automated supervisor engine that re-allocates overdue approval tasks or stalled queue jobs to high priority.
* **Storage Engine**: Responsible for managing SSD-based asset storage, metadata references, Base64 encoding, and retrieval.

## 8. AI Architecture
The platform coordinates local model processing using an explicit dual-engine pipeline:
User ──► FastAPI ──► Priority Queue ──► Gemma ──► ComfyUI ──► Storage ──► Frontend

### Text Pipeline
User Text Input ──► FastAPI Router ──► Ollama (Gemma2:2b) ──► Enriched Output String (Unloads from VRAM)
### Content Atomization
Content Atomization transforms a single Parent Asset into multiple independent Child Assets optimized for different communication channels.
Each generated child asset becomes a first-class Asset inside the platform and participates independently in approvals, activity logging, and version tracking.
Rather than modifying the original content, the system generates standalone assets while preserving lineage through Parent–Child relationships stored in PostgreSQL.

Master Script
    │
    ├── Blog Post
    ├── LinkedIn Post
    ├── Instagram Caption
    ├── Press Release
    └── Email Campaign

Each generated asset:
• receives its own Asset ID
• stores generation parameters
• maintains a Parent Version reference
• can evolve independently through Version Tracking

### Image Pipeline
User Text Input ──► FastAPI Router ──► Ollama (Gemma2:2b) ──► Enriched Prompt ──► ComfyUI API (SD 1.5) ──► 4X Model Upscaler ──► Final PNG File

## 9. Job Scheduler
Because the application runs on a local laptop featuring a single **NVIDIA RTX 4050 Laptop GPU (6 GB VRAM)**, concurrent AI generations will instantly cause an *Out of Memory (OOM)* system crash.

Priority Routing Model :
Priority Queue
├── Priority 1
│      Text
│      Summarize
│      Expand
│
└── Priority 2
       Images
       Upscaling

To solve this hardware bottleneck safely without adding Redis or Celery overhead, the platform uses an in-memory **`asyncio.PriorityQueue()` Worker Loop** built into FastAPI. 
* **Concurrency = 1**: The worker processes exactly one heavy GPU task at a time.
* **Priority Routing**: Light, fast text jobs (Priority 1) automatically bypass slow, heavy image rendering tasks (Priority 2) waiting in line. This prevents text modifications from being blocked by a 10-second image render.

## 10. Version Tracking
Unlike Git—which tracks delta line modifications, branch divergences, and diff trees—this platform implements a **linear snapshot ledger**. 
Every single edit to an image or text file completely leaves the old record intact. The platform saves a brand new file to the laptop SSD, appends a new row to the `asset_versions` table with an incremented version index number, and points to the new path. This keeps rollback operations dead simple for content creators.
**Snapshots, not diffs.**
Version Tracking records complete asset snapshots rather than storing textual differences, making restoration deterministic and computationally inexpensive.

## 11. Activity Service
The Activity Service acts as a system flight recorder for the workspace. Implemented via an append-only database table, it blocks all SQL `UPDATE` and `DELETE` operations. Every action—from security events (logins, logouts) to pipeline shifts (asset generation, rejections, escalations)—is permanently recorded to guarantee an audit trail.

## 12. Storage Pipeline
To maximize execution speed on 16 GB of system RAM, the local server completely bans raw binary data storage inside PostgreSQL.
ComfyUI Output ──► Project SSD Folder ──► File Path String saved to DB ──► Dynamic Base64 Conversion ──► JSON API Stream ──► React Render.

## 13. Security Infrastructure
Security is enforced using a stateless, decoupled architecture:
* **Password Security**: Passwords are hashed using bcrypt before storage.
* **Organization Isolation**: Every table utilizes an outer tenant identifier key, blocking cross-institutional database reads.
* **Stateless JWTs**: Access tiers are encoded directly inside security tokens, letting the server authorize operations without running a database query every time.
* **API Router Guards**: FastAPI dependencies intercept requests before they execute, protecting VRAM resources from unauthorized calls.

## 14. Scalability Roadmap
The system is built to scale smoothly from a local proof-of-concept into a production cluster:
* **Phase 1 (Current)**: Local laptop execution, in-memory FastAPI scheduling array, local SSD target tree.
* **Phase 2**: Add a Redis cache wrapper and decouple workers into isolated Celery processing nodes.
* **Phase 3**: Migrate model inference tasks to a serverless GPU infrastructure (e.g., Fal.ai or dedicated cloud nodes).

## 15. Future Roadmap
* **Video Generation**: Incorporate local video mock generation blocks (e.g., Stable Video Diffusion).
* **Voice Synthesis**: Integrate text-to-speech utilities for automated video narrative generation.
* **OCR & Speech Processing**: Parse uploaded assets for text extraction and transcription.
* **Internal RAG & Context Storage**: Allow organizations to index private asset vaults to provide context for AI tasks.
* **Enterprise Cloud Deployment**: Packages the app into modular Docker containers ready for secure Kubernetes clustering.
* **Plugin Support**: Allow organizations to integrate external AI providers and custom workflow extensions.

## 16. Novelty
• AI-driven Content Atomization
• Append-Only Version Tracking
• Activity Audit Service
• Local-First AI Infrastructure
• Priority GPU Scheduler
• Organization–Project–Station Asset Hierarchy
• AI-assisted Approval Workflow
• Automatic Approval Escalation

---

## 🧭 Guiding Principles
* **Human decisions always override AI decisions.**
* **Keep everything modular**: Write discrete repositories and distinct components so moving modules from local memory to a cloud cluster requires zero rewrite overhead.
* **Prefer simplicity over cleverness**: Write clean, readable code. Avoid over-engineering data flow structures when straightforward solutions get the job done.
* **Protect data over convenience**: Never permit an asset or log row to be overridden or dropped without validation checks.
* **Build features that can be demonstrated**: Prioritize functionality that translates into observable operations during project evaluations.
* **The software must remain deployable on a single laptop**: Maintain software loop structures so that the entire database, authorization layer, and AI pipeline spin up locally with a single terminal command.

---

## Technology Stack

Frontend
• React
• TailwindCSS

Backend
• FastAPI
• SQLAlchemy
• Alembic

Database
• PostgreSQL

AI
• Ollama (Gemma2:2b)
• ComfyUI
• Stable Diffusion 1.5

Authentication
• JWT
• bcrypt

Infrastructure
• asyncio.PriorityQueue
• Cloudflare Tunnel