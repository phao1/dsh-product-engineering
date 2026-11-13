# Product Engineering upstream review and DSH port rationale

Reviewed source: [phuryn/product-engineering](https://github.com/phuryn/product-engineering)
at `bdb2389c7636f6615c37fd66dd8518986284ec01`. License: MIT, copyright 2026
Pawel Huryn. Review date: 2026-11-12. This is a source-based review, not an
independent verification of the author's product outcomes.

## What the source actually contains

The repository has 44 skills in six packs. The 44 `SKILL.md` files alone contain
568,233 characters at this revision; their scripts, templates, receipts and
references are part of the functionality and cannot be replaced by a short
catalog. Each skill is designed to work from its own directory.

The pinned resource inventory includes 30 receipt files, 67 files under
`reference/` or `references/`, 18 files under `scripts/`, the Humanizer's
`check.py`, 20 example files, 9 template files, one owner-page HTML asset and
four Codex invocation-policy files. The DSH adapter retains these resources;
six extensively adapted vendor guides also retain a separately archived
original for comparison.

| Pack | Count | Role |
| --- | ---: | --- |
| product | 8 | Evidence, alternatives, segmentation, proposition and proposal |
| ai-shipping | 11 | Reviews, test quality, documentation and release gates |
| agent-teams | 4 | Delegation and external agent operation |
| agent-harness | 6 | Instructions, status, handover, learning, hooks and shells |
| app-stack | 14 | Product lifecycle and production SaaS integrations |
| work-humanizer | 1 | Faithful editing of work writing |

Four workflows are deliberately explicit-only: `start-here`, `ship-check`,
`handover`, and `retro`. Their invocation policy is part of the product, not
metadata to discard during translation. The two static audits also have narrow
triggers: a normal release proposes them rather than running them unasked.

## The method worth preserving

The collection starts from researched alternatives and customer evidence, then
puts the recommendation, representative screens and open decisions in one
reviewable artifact. `propose` distinguishes observations, owner constraints,
agent inferences and unsupported assumptions; a vendor's marketing is evidence
of its positioning, not proof of customer results. A source carries its address
and read date. A weak consequential assumption gets an experiment.

`start-here` routes ideas, agreed changes, bugs and releases differently. Small
work skips unnecessary planning. `app-lifecycle` has default stack choices but
places the product owner's decisions and existing project instructions above
those defaults. Upstream explicitly rejects translating the proposal into a
ticket tracker: its unit of review is the artifact and the working product.

`flight-deck` already addresses long-running continuity with rewritten current
status, an append-only log, and an owner page backed by artifact storage when
available. Proposal decisions stay on the proposal page. It calls out that an
owner-page response does not bypass a harness's separate permission checks.
Therefore “we add durable state to a collection with none” would be an incorrect
description of this port.

The review methods distinguish cooperating agents from an independent reviewer.
`independent-review` uses a fresh, unsteered subject and repeats after confirmed
fixes. Its stopping rule is no introduced finding above Low and no High or
Critical of any age. A reviewer claim is checked against code; an inherited
“tests passed” report is not accepted as the coordinator's own execution.

`test-harness` asks what each harness fakes. Where both client and host matter,
at least one check must make both real. It also requires an actual exit code,
fresh server/build identity, honest handling of flakes and layout evidence
beyond DOM assertions. These rules directly justify a real DSH integration
test for this port.

`release-gate` ties acceptance to the reviewed build and evidence. Production
operations, authorization, database migrations, email receipts, monitoring and
analytics are treated as part of shipping. The production examples are
opinionated SaaS guidance, not built-in DSH service implementations.

## Portability findings

| Upstream mechanism | DSH interpretation |
| --- | --- |
| Claude `/<pack>:<skill>` and Codex `$<pack>:<skill>` | Native first-line `/pe-<skill>` for users; DSH `skill` for permitted model calls |
| Claude `disable-model-invocation` plus Codex policy YAML | DSH's resolved user/model invocation policy; preserve all four explicit-only workflows |
| Claude `allowed-tools` audit frontmatter | Remove misleading host metadata; use DSH policy and scoped tools |
| Vendor tool names and branded model routing | Capability-based DSH equivalents; require a fresh reviewer where independence matters |
| Automatic Grok/Claude review wrappers | External CLIs remain optional, explicit integrations; native authorized DSH review is the default path |
| Vendor approval-bypass CLI flags | Do not carry them into active DSH instructions or automatically execute them |
| Claude `PreToolUse` hook configuration | DSH tool policy/lifecycle seams or project validation scripts; never pretend the hook syntax is native |
| Artifact-tool database owner page | Native authenticated DSH workbench and durable product records |
| `STATUS.md`, `LOG.md`, accepted proposal | Preserve their roles; export/reconcile durable records rather than claim a new method |
| Next.js/Supabase/Clerk/Netlify defaults | Keep as labeled external stack guidance, replaceable by the owner's actual stack |
| Embedded Claude Messages API / Agent SDK examples | Preserve as opt-in application integrations, not implementations of DSH's agent runtime |
| Staygreen default | Preserve the author's disclosure; do not imply DSH endorses or bundles the service |

The importer should preserve receipts and explanatory scope. Host adaptation
must be inspectable: original path and hash, destination path, adapter version
and changed categories. Merely appending “use DSH instead” while leaving active
incompatible commands would not be a complete port.

The pinned DSH source has optional `subagent_codex` and
`subagent_claude_code` providers. Their presence is not assumed, and their
one-shot interface is not advertised as resumable vendor-session control.
Actual read-only isolation and model identity must be checked from the selected
provider's configuration. Native delegation, a fresh conversation and a
different model family are three different properties; none implies the other
two. External peer skills must preserve the requested peer's identity or
report that it is unavailable.

The upstream repository's maintainer instructions are not a mandate to run its
release machinery in this project. Its preferences for reviewer vendors,
automatic upstream publication, private leak lists and its author's model
selection are not inherited deployment authority for DSH-plugin.

## Where the DSH implementation improves the experience

These improvements are narrow, testable and relative to using the upstream
folders directly in DSH:

1. **Native discovery and invocation.** The full catalog, relative resources and
   correct invocation policy load through DSH's skill registry.
2. **One owner surface.** The current stage, open choices, evidence and artifacts
   use the existing DSH panels and session handoff.
3. **Executable integrity.** Atomic writes, revision conflicts, reference
   validation and workspace access checks enforce invariants that prose alone
   cannot enforce.
4. **Evidence freshness.** Editing reviewed intent or evidence invalidates an
   affected pass; old green marks cannot silently certify new content.
5. **Approval identity.** Agent drafts and owner attestations are different
   operations. A tool cannot impersonate a human by sending an actor field.
6. **Portability and auditability.** Local JSON/Markdown exports and a recorded
   source revision make the adaptation inspectable and recoverable.

None establishes market superiority or uniqueness. The source already supplies
many of the product ideas. Improvement claims require the corresponding tests
and a real owner workflow, not a polished screenshot alone.

## Deliberate differences and limits

Upstream discourages pinning installed packs because a stale copy misses fixes.
This adapter pins its input because automatic unreviewed changes could break
DSH invocation or policy. The proper response is a reproducible update/import
path with change review, not silently serving an old revision forever.

The first DSH interface uses five navigation stages, while the upstream public
journey has eight steps and `app-lifecycle` has more detailed stage guidance.
These are navigation groupings, not a claim that upstream has only five stages.
The 44 methods remain individually available, and small work may use a method
without traversing every workbench stage.

Evidence is recorded and linked; this version is not an automatic research
fact-checker, CI runner, deployment platform or independent-review service.
External accounts, browsers, models and vendor CLIs still need their own
capabilities and authorization. A check marked passed must make its attestation
and supporting evidence visible, without implying that the plugin ran it.

## Review sources in the checkout

The review draws on root `AGENTS.md`, `README.md`, `rejected.md`, `LICENSE.md`,
the inventory/frontmatter/headings of all 44 skill bodies, and detailed reading
of proposal, lifecycle, flight-deck, independent review, release gate and test
harness guidance. The port's skill owner performs the comprehensive text and
resource adaptation audit. That distinction avoids claiming every reference
or vendor script was manually executed during architecture review.

The DSH seams were checked against `docs/architecture.md`, the bundled Cordis
plugin-development references, `packages/skill/skill/src/index.ts`,
`packages/client/connection/src/rpc.ts`, the Gateway and registry APIs, and
existing native Client panel registrations at the pinned DSH revision.
