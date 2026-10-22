# Agent.md — AI Campus Copilot

Project context and working documentation for the **AI Campus Copilot** — a campus knowledge RAG (Retrieval-Augmented Generation) assistant with role-based access control.

## 1. Project Overview

Admins publish approved PDF documents (exam schedules, regulations, notices). These are parsed page-by-page, chunked, embedded, and stored in a Qdrant vector DB. Students ask questions and receive answers **grounded strictly in approved documents**, with page-level `[n]` citations. Students can dispute wrong answers via a "Knowledge Dispute Desk"; admins resolve disputes and supersede old document versions. All admin actions are written to an audit log.

## 2. Repository Structure

Two-package monorepo, git repo at root (`.gitignore` covers `node_modules`, `dist`, `.env`, `uploads/`). **Fully local stack: no cloud services.** Database is a local **SQLite file** (`Backend/prisma/dev.db`), all uploaded files live on disk (**`Backend/uploads/`**), the vector store runs as a local Qdrant instance, and the only external call is the OpenAI API (optional, needed for RAG):

```
AI-COPILOT/
├── Backend/        Express + Prisma (SQLite) + Qdrant RAG API (TypeScript, CommonJS)
│   ├── src/
│   │   ├── index.ts / app.ts / config/env.ts
│   │   ├── middleware/   auth.ts, error.ts
│   │   ├── routes/       meta, auth, notices, documents, chat, reports
│   │   ├── services/     ingest.ts, rag.ts
│   │   └── lib/          prisma, qdrant, pdf, chunk, openai, http, audit
│   ├── prisma/     schema.prisma (sqlite), dev.db (the database file),
│   │               migrations/, seed.ts
│   ├── probe-filter.ts   standalone RBAC-filter probe (not part of build)
│   └── uploads/    saved PDFs (served statically at /uploads)
└── Front-end/      Vite + React 19 + Tailwind 4 SPA
    └── src/
        ├── main.tsx / App.tsx / auth/AuthContext.tsx
        ├── components/LegalLayout.tsx
        ├── lib/          api.ts, types.ts
        └── pages/        LoginPage, StudentPortal, AdminPortal,
                          PrivacyPolicy, TermsAndConditions
```

## 3. Backend

### 3.1 Stack & Scripts

- Deps: `@prisma/client ^6.5`, `@qdrant/js-client-rest ^1.12`, `bcrypt`, `cors`, `dotenv`, `express ^4.21`, `jsonwebtoken`, `multer ^2.4`, `openai ^4`, `pdf-parse`, `uuid`.
- Scripts: `dev` (tsx watch), `build` (tsc -p tsconfig.build.json → dist/), `start`, `typecheck` (tsc --noEmit), `db:generate|migrate|deploy|seed|studio|reset`. Seed = `tsx prisma/seed.ts`.
- TS: CommonJS, ES2021, strict.

### 3.2 App Assembly (`src/app.ts`, `src/index.ts`)

`createApp()`: disable `x-powered-by` → CORS (permissive in dev; loopback regex + comma-separated `CORS_ORIGIN` list + `*`; sub-router order: public `metaRouter`, `authRouter` → guarded `noticesRouter`, `documentsRouter`, `chatRouter`, `reportsRouter`) → `express.json({limit:'2mb'})` → static `/uploads` → `notFoundHandler` → `errorHandler`.

`src/index.ts` `main()`: create `uploads/` dir → `ensureCollection()` (warns, continues if Qdrant down) → `app.listen(env.port)` + startup banner. Warns if `OPENAI_API_KEY` empty.

### 3.3 Config (`src/config/env.ts`)

Loads dotenv from `Backend/.env`. **Hard-fails at boot if `JWT_SECRET` missing.**

| Var | Default | Notes |
|---|---|---|
| `JWT_SECRET` | required (throws) | JWT signing |
| `JWT_EXPIRES_IN` | `12h` | token TTL |
| `PORT` | `4000` | backend port |
| `NODE_ENV` | `development` | |
| `DATABASE_URL` | — | **SQLite file URL**, e.g. `file:./dev.db` (relative to `prisma/schema.prisma` → `Backend/prisma/dev.db`) |
| `SEED_SUPER_ADMIN_PASSWORD`, `SEED_DEPT_ADMIN_PASSWORD`, `SEED_STUDENT_PASSWORD` | — | seed only |
| `QDRANT_URL` | `http://localhost:6333` | |
| `QDRANT_API_KEY` | — | optional |
| `QDRANT_COLLECTION` | `campus_knowledge` | |
| `OPENAI_API_KEY` | `''` | required for RAG; 503 otherwise |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | 1536-dim (hardcoded) |
| `CHAT_MODEL` | `gpt-4o-mini` | |
| `CORS_ORIGIN` | `http://localhost:5173` | comma list or `*` |

Blog note: `uploadsDir` is resolved to `Backend/uploads` (not env-driven).

### 3.4 Middleware

- **`middleware/auth.ts`** — `AuthClaims { id, email, role, departmentId, semester }` (augments `Request.user`); `signToken`, `toClaims`; `authenticate` (Bearer JWT → `req.user`, else 401); `requireRole(...roles)` (403 factory); `requireClaims`.
- **`middleware/error.ts`** — `notFoundHandler` (404 JSON), `errorHandler`: `ApiError` → status/message/details; JSON parse → 400; `MulterError` → 400; Prisma `P2002` → 409; else 500 `{ error: 'Internal server error' }`.

### 3.5 Lib Layer (`src/lib/`)

- **`http.ts`** — `ApiError(status, message, details)`; factories `badRequest/unauthorized/forbidden/notFound/serviceUnavailable`; `asyncHandler` wraps async routes.
- **`prisma.ts`** — singleton `PrismaClient` cached on `globalThis`.
- **`qdrant.ts`** — `qdrant` client, `COLLECTION`, `ensureCollection()` (1536-dim Cosine, on-disk payload; payload indexes on `status`, `departmentId`, `documentId`, `semester`); `upsertVectors` (batch 64, `wait: true`); `markPayloadByDocument` (setPayload by `documentId` filter — flips chunks to `SUPERSEDED`).
- **`pdf.ts`** — `extractPdfPages(buffer)` using `pdf-parse` `pagerender` to get text **per page** (each chunk keeps an exact page number for citations).
- **`chunk.ts`** — `chunkText(text, page, chunkTokens=400, overlapTokens=60)` (word-based splitting with carried overlap); `chunkPages(pages)` chunks each page keeping 1-based page numbers. Chunks < 40 chars filtered later.
- **`openai.ts`** — lazy client; 503 `serviceUnavailable` if no key. `embedTexts` (batched, 64/batch), `embedQuery`, `createChatCompletion(messages)` — `temperature: 0.1`, `max_tokens: 900`.
- **`audit.ts`** — `writeAudit({ actorId, action, entityType, entityId, metadata })` → `AuditLog` table.

### 3.6 Services (`src/services/`)

- **`ingest.ts`** — `ingestDocument(input)` → `{ chunkCount, pageCount, skippedPages }`. Pipeline: `chunkPages` → drop chunks < 40 chars → `embedTexts` → Qdrant points with payload `{ documentId, chunkId: "<docId>:<page>:<index>", title, category, text, page, departmentId, semester, version, status: 'PUBLISHED' }` → `upsertVectors`. Throws if no extractable text.
- **`rag.ts`** — `RETRIEVAL_LIMIT = 6`; `retrieveKnowledge(query, { departmentId, limit })`: `embedQuery` → Qdrant ANN query with `buildRetrievalFilter(departmentId)` — **RBAC enforced inside Qdrant pre-retrieval**: `must: [status == 'PUBLISHED']`, `should: [departmentId == <dept> OR departmentId is null]` (null = institution-wide). Students can never receive another department's or superseded chunk. `buildContextBlock` makes numbered `[1]..[n]` context lines; `collectCitations(answer, chunks)` parses `/\[(\d{1,2})\]/g` markers into `SourceCitation[]`.

### 3.7 API Endpoints

| Method & path | Roles | Behavior |
|---|---|---|
| GET `/api/health` | public | `{ status:'ok', service, time }` |
| GET `/api/departments` | public | departments by `code` asc |
| POST `/api/auth/login` | public | bcrypt + **DUMMY_HASH anti-enumeration** when user missing; returns `{ token, claims, user: PublicProfile, redirectTo }` (`/student` or `/admin`) |
| GET `/api/auth/me` | auth | fresh PublicProfile (401 if deleted) |
| GET `/api/notices` | auth | active notices (campus-wide OR caller's dept + semester scoping for students); returns `scope` label |
| POST `/api/admin/documents` | SUPER_ADMIN, DEPT_ADMIN | multipart field `file`, PDF only, 20 MB, sanitized filename `Date.now()-uuid8-name.pdf` → parse → Document (PROCESSING) → ingest → PUBLISHED → supersede older versions in same "family" (title+dept+semester, case-insensitive) in DB **and** Qdrant payload → audit `DOCUMENT_PUBLISHED` → 201. DEPT_ADMIN forced to own dept. Ingest failure reverts to PROCESSING. |
| GET `/api/admin/documents` | SUPER_ADMIN, DEPT_ADMIN | scoped list + `supersededBy`, `openReports`, `scope` |
| GET `/api/admin/documents/:id` | SUPER_ADMIN, DEPT_ADMIN | dept-scoped detail (404/403) |
| POST `/api/chat` | **STUDENT** | RAG answer (see flow below) |
| POST `/api/reports` | **STUDENT** | `ContentReport` (OPEN); reason whitelisted (`Incorrect information`, `Outdated information`, `Answer not supported by the cited source`, `Wrong department or semester scope`, `Other`); detail ≤ 1000; answer truncated to 4000 |
| GET `/api/admin/reports` | SUPER_ADMIN, DEPT_ADMIN | dispute queue `?status=OPEN|RESOLVED` (default OPEN); DEPT_ADMIN scoped by student dept |
| POST `/api/admin/reports/:id/resolve` | SUPER_ADMIN, DEPT_ADMIN | access check, `RESOLVED` + `resolvedAt`, audit `REPORT_RESOLVED` |

**Chat flow (`routes/chat.ts`):** question (≤ 1200 chars) → must have `departmentId` → optional `history` (last 6 turns, 800-char clip) → `retrieveKnowledge` → nothing usable ⇒ fixed refusal `"I could not find an answer to that in the approved campus documents."` (`grounded: true`) → else context block + strict SYSTEM_PROMPT (answer only from context, mandatory `[n]` citations, exact refusal phrase when unsupported, never invent dates/pages, ≤ 200 words) → response `{ answer, sources, retrievedChunks, grounded }`.

### 3.8 Prisma (`prisma/schema.prisma`)

Provider **sqlite**, `DATABASE_URL` env (`file:./dev.db` → `Backend/prisma/dev.db`). SQLite caveat — Prisma ignores native enums and `Json` types on SQLite, so:

- `Role`, `DocumentStatus`, `ReportStatus` are **plain `String` columns** validated at the app layer (`Role` union type exported from `middleware/auth.ts`; strings checked with `isRole`, `REPORT_REASONS`, etc.).
- `AuditLog.metadata` is a **`String` column** storing `JSON.stringify(...)` (see `lib/audit.ts`).
- `mode: 'insensitive'` is PostgreSQL-only, so document "family" matching by title is done case-insensitively **in JavaScript** (see `findFamily` in `routes/documents.ts`).

Models (all `id` = `cuid`):

- **Department**: `id (cuid)`, `name`, `code @unique`; → users/documents/notices.
- **User**: `name`, `email @unique`, `passwordHash`, `role`, `semester Int?`, `departmentId?`; idx `[role]`, `[departmentId]`.
- **Document**: `title`, `category`, `fileUrl`, `fileName?`, `pageCount`, `chunkCount`, `semester?`, `version` (1), `status`, `departmentId?`, `uploadedByUserId`; idx `[title]`, `[departmentId, semester]`, `[status]`.
- **Notice**: `title`, `body`, `semester?`, `expiresAt?`, `departmentId?`; idx `[departmentId, expiresAt]`.
- **ContentReport**: `query`, `answer?`, `reason`, `detail?`, `status`, `resolvedAt?`, `documentId?`, `studentId`; idx `[status]`.
- **AuditLog**: `action`, `entityType`, `entityId`, `metadata` (JSON string), `timestamp`, `actorId`; idx `[entityType, entityId]`, `[timestamp]`.

Migration: single `20261022115506_init` (SQLite). FKs: SET NULL for department links, RESTRICT for uploadedBy/student/actor.

**`seed.ts`** — idempotent; departments **CSE** / **ECE**; accounts `admin@campus.edu` (SUPER_ADMIN), `cse_admin@campus.edu` (DEPT_ADMIN/CSE), `student@campus.edu` (STUDENT, CSE, sem 5); bcrypt 10 rounds; 4 sample notices with staggered expiries; required envs enforced.

## 4. Front-end

### 4.1 Stack & Scripts

- Deps: react ^19, react-dom, react-router-dom ^7, tailwindcss ^4 + `@tailwindcss/vite`, lucide-react.
- Dev: vite ^8, `@vitejs/plugin-react`, `@rolldown/plugin-babel` + **`babel-plugin-react-compiler` (React Compiler enabled)**, TypeScript, eslint 10.
- Scripts: `dev`, `build`, `lint` (eslint .), `preview`, `typecheck` (tsc --noEmit).
- `vite.config.js`: plugins `react()`, `babel(reactCompilerPreset())`, `tailwindcss()`. **No dev proxy** — SPA calls the API directly by absolute URL; default dev port 5173 matches backend `CORS_ORIGIN` default.
- `index.css` = `@import "tailwindcss";`

### 4.2 Routing & Auth

- Routes (`App.tsx`): `/` → `HomeRedirect` (to `user.homePath` or `/login`), `/login`, `/privacy`, `/terms`, `/admin/*` (`RequireRole ADMIN_ROLES`), `/student/*` (`RequireRole ['STUDENT']`), `*` → styled 404. `RequireRole` → `/login` if unauthenticated, else `homePath` if wrong role.
- `auth/AuthContext.tsx` — `useAuth`; `ADMIN_ROLES = ['SUPER_ADMIN','DEPT_ADMIN','FACULTY']`, `MANAGER_ROLES = ['SUPER_ADMIN','DEPT_ADMIN']`, `roleLabel`. Session `{ token, claims, user }` persisted in `localStorage` key `campus-copilot.session`. Registers `setUnauthorizedHandler` so **any 401 clears the session**. `updateProfile({name})` is client-side only.

### 4.3 API Layer (`lib/api.ts`)

- `API_PORT = 4000`. `resolveApiBase()`: `VITE_API_URL` if set, else `http://<window hostname>:4000` (IPv6-bracketed) — works on localhost/LAN without config. `Front-end/.env` documents `VITE_API_URL` (optional, commented out).
- `apiFetch<T>(path, options)`: attaches `Bearer` from session, JSON-serializes object bodies, passes `FormData` through (uploads), reads errors as `{ error }`, throws local `ApiError(status, message)` (status 0 for network failures), triggers unauthorizedHandler on 401, handles 204. `loginRequest()`, `profileRequest()`.

### 4.4 Pages

- **`LoginPage`** — split-screen; development-only demo quick-fill chips (password `CampusDemo2026!`); redirect to `homePath`; show/hide password.
- **`StudentPortal`** (~820 lines) — profile/settings dropdown; notices sidebar (`GET /api/notices`); chat (`POST /api/chat` with `{ message, history }`, Enter sends / Shift+Enter newline, pending "Retrieving approved sources" bubble, citation chips `[n] Title Page x`); "Report incorrect information" modal → `POST /api/reports`; local Q&A history in `localStorage` (`campus-copilot.qa-history`, max 100).
- **`AdminPortal`** (~670 lines) — summary cards; *Documents* tab: upload form (title, category from fixed `CATEGORIES`: Examination, Academic Regulation, Timetable, Syllabus, Notice Circular, Placement, Laboratory, Administration; scope `institution`|dept, semester, version, PDF) + table with status/supersede chips; *Knowledge Dispute Desk* tab: open reports, Resolve (canned note) and Replace document (pre-fills next version). DEPT_ADMIN scope locked; FACULTY read-only.
- **`PrivacyPolicy`** / **`TermsAndConditions`** — static content via `components/LegalLayout.tsx`.

### 4.5 Types (`lib/types.ts`)

Mirrors backend payloads: `Role`, `DocumentStatus`, `ReportStatus`, `AuthClaims`, `PublicProfile`, `LoginResponse`, `Session`, `Department`, `DocumentRow`, `UploadResponse`, `SourceCitation`, `ChatResponse`, `NoticeItem`, `ReportStudent`, `ReportDocument`, `ContentReportRow`, `ChatMessage`.

## 5. Ports & Services

- Backend: **4000** (serves `/uploads` statically).
- Front-end dev: **5173** (Vite default).
- Qdrant: **6333**.
- DB: **SQLite** local file (`Backend/prisma/dev.db`, Prisma 6 — zero-configuration local storage). Uploads: **local disk** (`Backend/uploads/`, served at `/uploads`). Vector DB: **Qdrant** (`campus_knowledge`, 1536-dim Cosine, local instance). AI: **OpenAI** — `text-embedding-3-small` (batch 64) + `gpt-4o-mini` (temp 0.1, max_tokens 900).

## 6. Key Data Flows

- **Ingest:** upload (multer → `uploads/<ts>-<uuid8>-<name>.pdf`) → `extractPdfPages` → validate text → `chunkPages` (~400 tok, 60 overlap, ≥40 chars) → `embedTexts` → `upsertVectors` (payload with RBAC metadata, status PUBLISHED) → DB PUBLISHED + supersede older family versions (DB + Qdrant setPayload) → audit.
- **Chat:** question → `embedQuery` → Qdrant ANN with server-side RBAC filter (PUBLISHED + own dept OR institution-wide) → top 6 chunks → numbered context → OpenAI grounded-citation completion → parse `[n]` into sources → respond; refusal fallback.
- **Dispute:** student flags answer → `ContentReport` (OPEN) → admin queue (dept-scoped) → resolve (audit) and/or republish superseding version.

## 7. Conventions

- **Errors:** central `ApiError` + factory helpers; every async route wrapped in `asyncHandler`; single terminal `errorHandler`. FE mirrors with its own `ApiError` and per-component error banners.
- **Security:** bcrypt (10 rounds) + dummy-hash anti-enumeration login; 12h JWT; RBAC at route level (`requireRole`) **and inside Qdrant via pre-retrieval filters**; upload sanitization (extension/mimetype check, filename scrub, 20 MB cap); audit log for admin actions.
- **Naming:** PascalCase for FE components/pages; lowercase BE modules (`rag.ts`, `chunk.ts`); exported named functions; interfaces suffixed by role (`IngestInput/Result`, `RetrievedChunk`, `SourceCitation`, `PublicProfile`); SCREAMING_SNAKE constants; route handlers declare full paths (e.g. `'/api/admin/documents'`) inside routers mounted at root.
- **FE style:** TypeScript strict, function components + hooks only, plain `fetch` (no data-fetch library), Tailwind utility classes (slate/emerald palette), lucide-react icons, ARIA attributes, single default export per page.
- **Docs-in-code:** explanatory comments describe *why* (anti-enumeration, RBAC-in-Qdrant, page citations) — preserve this style.
- **No comments rule for new generic code:** only add comments where they explain non-obvious intent, matching the existing style.

## 8. Useful Commands

```bash
# Backend
cd Backend
npm install
npm run db:generate && npm run db:migrate && npm run db:seed
npm run dev            # tsx watch on :4000
npm run typecheck

# Front-end
cd Front-end
npm install
npm run dev            # vite on :5173
npm run lint && npm run typecheck

# RBAC probe (optional)
npx tsx Backend/probe-filter.ts
```

Note: full function requires `JWT_SECRET`, `DATABASE_URL` (SQLite `file:./dev.db`), seed passwords in `Backend/.env`, and a running local Qdrant instance (`QDRANT_URL`). In development, the seeded demo admin and student use `CampusDemo2026!`; production seeds require their configured passwords. `OPENAI_API_KEY` is required for ingest/chat (503 otherwise). Everything else — database, uploaded files — is stored locally.
