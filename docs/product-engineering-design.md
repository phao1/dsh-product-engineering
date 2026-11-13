# DSH Product Engineering · 产品交付台: design and acceptance contract

Status: implementation contract for the first DSH port. Implementation and test
reports, rather than this document, establish what has shipped.

## Product intent

Give a product owner one DSH workspace in which to understand the current stage,
inspect the evidence, make consequential decisions, and start the appropriate
product-engineering method. Keep the original collection's artifact-first
approach: the owner reviews the product, its intent and its evidence. This is not
a ticket tracker.

The source is Pawel Huryn's MIT-licensed
[product-engineering](https://github.com/phuryn/product-engineering), pinned for
this adaptation at `bdb2389c7636f6615c37fd66dd8518986284ec01`. The first target is
DeepSeek Harness `0.2.1-rc.2`, local source commit
`687f282e8625c6b8d11ff58211a90524be2e4317`. DSH's APIs are pre-stable; compatibility
with later versions needs a real install-and-run check.

Upstream already specifies durable proposals, decision logs, status files and an
owner page. The additional value here is executable DSH integration: durable
structured records, optimistic concurrency, workspace-scoped agent access,
evidence-aware gates, native skill discovery and a Chinese-first owner surface.
These are implementation improvements, not claims that the underlying product
method is new or uniquely available.

## Deliverable and ownership

One ESM package, `plugins/dsh-product-engineering`, package identity
`dsh-product-engineering`, version `0.1.0`. No publication is part of the build.

| Path | Responsibility |
| --- | --- |
| `src/core/` | Validated records, commands, gates, SQLite store, portable export |
| `src/host/` | DSH effects, authenticated owner RPC, scoped model tools, skills |
| `src/client/` | Native workbench, forms, catalog, session handoff, downloads |
| `skills/pe-*/` | All 44 adapted instructions and their local resources |
| `upstream/catalog.json` | Pack/skill catalog and the selected source revision |
| `upstream/` | Attribution, content hashes, adaptation records, license |
| `scripts/` | Reproducible build, skill validation, packaging checks |
| `tests/` | Core integrity and host/client integration tests |

The package exports the Host module, a browser module-loader factory, locales and
an original icon. `dsh.bundle.patch` inserts the plugin; `dsh.client` declares its
native Client face. Installation uses the supported DSH plugin/profile path.
There is no replacement application root or unauthenticated companion server.

## Native DSH integration

The Host registers all contributions as Cordis effects so disabling the bundle
withdraws its tools, skills, RPC interceptor and UI registrations. It does not
change the agent loop or the existing Session format.

* Skills use `ctx.skills.registerProvider`, rank `BUNDLED_SKILL_RANK`, a directory
  resource base, and real invocation flags. Names are `pe-<upstream-name>`.
* The Client registers the workbench in the existing `main` panel and its
  launcher in `sidebar.panellist`; React comes from DSH's module table.
* Owner operations use `ctx.connection.rpc.call('/api',
  'product-engineering/workspace', request)`. The Host registers an exact
  buffered POST route at `/api/product-engineering/workspace` through
  `ctx.connection.fetch.register`. DSH authenticates requests and admits only
  owner principals to exact Fetch routes. The adapter validates the unary
  request envelope and uses the same correlated response envelope as the
  native caller. It does not treat every authenticated remote peer as the owner.
* Model tools call the same domain commands with an agent actor. The Session's
  originally selected working directory (`Session.header.cwd`), validated as a
  stable canonical identity without trimming filesystem-significant characters,
  is the authorization scope. A retargetable symlink alias cannot change the
  scope. Changing the effective execution directory does not expand it; a
  supplied project ID never grants access to another workspace.
* Catalog launch uses DSH's existing session creation/input capability and the
  native first-line `/pe-...` invocation. It must not simulate model execution or
  silently mark an artifact complete when a skill is merely launched.

An optional browser or an external Codex/Claude/Grok CLI remains a prerequisite,
not a capability supplied by this package. Policy, sandboxing and credential
handling remain DSH-owned.

## Data and consistency

The persistence unit is a product project with `schemaVersion`, opaque `id`,
`title`, `summary`, canonical `workspacePath`, `stage`, monotonic `revision`,
timestamps, and collections of artifacts, evidence, decisions, checks and
activity. Storage is a profile-local SQLite database through `node:sqlite`.
Transactions and compare-and-swap revisions prevent lost updates from multiple
tabs or processes. Future schema versions fail explicitly rather than being
silently reset. JSON and Markdown exports keep the work portable.

Node's SQLite support can emit an experimental warning on the supported Node
version. The package must document the actual version tested. Core persistence
does not rely on browser local storage.

| Record | Minimum useful fields | Meaning |
| --- | --- | --- |
| Artifact | Type, title, content, source skill, evidence IDs, timestamps | Reviewed intent or a product deliverable |
| Evidence | Kind, title, URI when applicable, summary, timestamps, revision | A recorded source or result, with an explicit origin |
| Decision | Question, context, options, status, choice, rationale, evidence IDs | An unresolved or recorded owner choice |
| Check | Category, requirement, status, evidence IDs, note, review revision | An evidence-backed release condition |
| Activity | Actor, command, affected record, revision, time | Traceable changes; never a fabricated execution trace |

Artifact types cover brief, research, PRD, design, architecture, plan, review,
experiment, launch and note. Evidence kinds cover URL, file, command and note.
Links are references; registering a command's output is not execution or an
independent verification. UI labels and exports must preserve that distinction.

Persisted and wire values are validated at their boundaries. Unknown commands,
malformed IDs, dangling references, conflicting revisions, missing projects and
unsupported schema versions receive structured errors. A caller must re-read
after a conflict; it must not silently retry a stale destructive overwrite.

An artifact or linked evidence edit invalidates an affected prior check's
pass. Approval is tied to the reviewed state, not a reusable green checkbox.
Changes to a check's own status do not invalidate unrelated checks. No persisted
content is interpreted as HTML by default; links permit only the expected
schemes and exports escape where their format requires it.

## Owner and agent boundaries

The owner can create projects, edit records, resolve or reopen decisions,
attest checks, waive a requirement with a reason, and move the stage. An agent can read its
workspace's projects, draft artifacts, record evidence and propose decisions.
An agent cannot supply an `actor: human` field to obtain owner powers.
Actor identity is set by the trusted Host surface, not request JSON.

Recorded acceptance is not a deployment authorization. This plugin never
deploys, purchases, sends messages, publishes secrets or bypasses DSH approval
policy. A stage reaching “ship” describes readiness of the recorded project.
External action still uses the user's current instructions and normal tools.

## Progression and owner experience

Five navigation stages condense the upstream eight-step journey without
discarding its methods:

| DSH stage | Upstream work | Normal condition for entry |
| --- | --- | --- |
| Discover / 发现 | Start, alternatives, segment, proposal | A project exists |
| Design / 设计 | Accepted direction, jobs, screens, assumptions | A brief exists |
| Build / 构建 | Implementation, tests, independent review, click-through | A PRD or plan exists |
| Ship / 发布 | Release review and release evidence | No pending owner decisions; required checks satisfied |
| Grow / 增长 | Observed use, operations, next experiment | A launch record exists |

Forward movement is one stage at a time; backward movement is allowed and
logged. A small agreed change may use a build skill directly, without using
the workbench's optional structured progression. Any
configured readiness waiver remains visible with its rationale. Moving stages
does not automatically run a skill.

The release defaults cover accepted product scope, test evidence, independent
review and release/rollback intent. A required check passes only with evidence,
or is explicitly waived by the owner with a reason. Both passes and waivers
expire when the reviewed intent changes. Adding an unrelated evidence record
alone does not expire existing checks. Pending and stale evidence
remain visible as blockers. Arbitrary percentages, invented live telemetry and
pre-populated green states would be misleading and are excluded.

The main workbench gives an owner:

1. A project switcher and real empty/create states.
2. A stage rail, next action and concrete blockers.
3. Editable artifacts with visible evidence links.
4. One pending-decisions inbox with recorded choices.
5. An evidence ledger and release checklist.
6. All 44 skills searchable by pack, stage and invocation policy.
7. A native session handoff and local JSON/Markdown export.

The UI is Chinese-first with descriptive labels, keyboard-accessible forms,
visible save/error states and host theme inheritance. Demo content, if offered,
is an explicit action and clearly marked as sample data. First use must never
pretend that a sample project is the user's real work.

## Wire contract

The shared command definitions in `src/core/types.ts` are authoritative. Owner
RPC uses channel `/api`, endpoint `product-engineering/workspace`, and these request
families:

```ts
type Request =
  | { op: 'catalog' }
  | { op: 'list' }
  | { op: 'get'; projectId: string }
  | { op: 'create'; title: string; summary?: string; workspacePath?: string }
  | { op: 'mutate'; projectId: string; expectedRevision: number; command: Command }
  | { op: 'export'; projectId: string; format: 'json' | 'markdown' }
```

`Command` is `ProjectCommand` from the shared type file: `project.update`,
`artifact.save`, `evidence.add`, `decision.add`, `decision.resolve`,
`decision.reopen`, `check.set`, and `stage.move`. It is not a generic patch of
arbitrary persisted JSON.
Mutation responses return the new aggregate/revision so the UI can reconcile
without guessing. The Connection envelope is `{ ok: true, value }` or
`{ ok: false, error }`; errors carry a stable code, readable message and useful
details. Inside a successful carrier response, the domain result is
`{ ok: true, data }` or `{ ok: false, error }`, as defined by `ProductResponse`.
The shared `/api` channel already has the core Gateway interceptor;
registering another there would fail composition. The installed `0.2.1-rc.2`
runtime also failed to activate a dedicated `connection.rpc.handle` route:
its internal service context tried to access `webServer` without injection,
leaving the request to the SPA fallback (HTTP 405). An actual packed-runtime
probe reproduced this despite all required services and model tools being
present. The final exact Fetch route composes ahead of the existing Gateway
interceptor and retains DSH's owner admission and body-size limit. A transport
failure and a rejected domain mutation must not render as
a successful save. Root package configuration can supply a default workspace
directory; otherwise create must obtain one through the existing workspace UI.

## Acceptance evidence

The delivery report records actual commands, exit codes and supported limits.
The minimum meaningful checks are:

* Exactly 44 adapted skills across 6 packs; all resource paths resolve; 4
  explicit-only workflows remain model-disabled; MIT notice and source hashes
  ship in the packed package.
* Persistence survives reopen; two writers cannot lose an update; corrupt/future
  state fails explicitly; dangling evidence is rejected.
* A model in workspace A cannot list or mutate workspace B; model tools cannot
  resolve owner decisions, waive checks or advance readiness; a non-owner RPC
  peer cannot obtain any project data.
* Gates reject missing evidence, pending decisions and stale attestations;
  completion and waiver reasons appear in exports.
* A real DSH profile loads the bundle, lists and loads a skill, exposes the
  workbench, saves an actual project, and withdraws contributions on unload.
* A real browser checks create/edit/decision/gate/export and verifies the native
  session handoff. Screenshot review covers narrow/wide widths and host theme
  behavior; a DOM-only test does not establish visual quality.

Missing credentials may prevent paid live model work. Such a limitation does
not prevent persistence, registry, authentication or browser integration tests,
and it must be reported separately rather than turning a mock into a live pass.

## 0.2.0 bounded workflow extension

The persisted project remains schema version 1. The read projection adds
`evidence: EvidenceView[]`, with `freshness` equal to `reported`, `current`, or
`stale`. Every file snapshot is checked, including snapshots not referenced by
a passed check. Only evidence linked to a required check affects that check's
release status. Restoring identical bytes can restore digest freshness; this is
a current-byte comparison, not a filesystem event history.

`artifact.importFile` accepts an optional existing artifact ID, an artifact type,
title, workspace-relative `path`, optional skill ID and evidence links. One
bounded file read produces both the UTF-8 body and SHA-256 digest; one revision-
checked mutation appends the immutable snapshot and saves the artifact. Prior
records remain available. No background watcher or repository writes are added.
Reimporting does not attest checks or resolve owner decisions.

A derived remediation plan maps existing release blockers to owner decisions or
check preparation tasks. It references recorded evidence, recommends existing
skills, and states what remains to verify. The client can open a native unsent
session draft for preparation work. The first step re-reads the project to avoid
working from an old revision. Markdown exports include the plan. This does not
constitute repository scanning, automated execution or verification of fixes.
