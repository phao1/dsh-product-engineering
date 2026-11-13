---
name: pe-flight-deck
description: "'What's the status', 'where were we', a progress report or status deck; long work that must survive compaction: multi-hour runs, background jobs, waiting on a decision."
user-invocable: true
---

# Flight Deck — surviving your own context window

## DeepSeek Harness

This skill is available through `skill({ name: "pe-flight-deck" })` or the user's `/pe-flight-deck` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**Write state down where it cannot be summarized.** In a long session, tool output scrolls away and context becomes a plausible narrative with operational details sanded off. The work keeps running while your model of it goes stale. Then you re-run a paid job, report a number from memory, or forget that something is blocked.

**Keep current status and durable decisions available after compaction.** Use `STATUS.md` and `LOG.md` when the project already has these files or needs a local handoff. The Product Engineering workbench supplies the owner's project view when it is available.

## The two files (per area, not per repo)

**Rewrite `STATUS.md` in place to describe only what is true now.** Never append to it, because a growing status file leaves the reader unsure which line is still true. Use these sections where they earn their place:

- **Put RESUME first, with the work's location and how to resume.** Name the repository or folder and branch, then the last few sessions that touched it. Give each a date and one-line summary, dropping the oldest. Resume by opening the agent in that folder and having it read `STATUS.md` first. Reopening an old session is the fallback, because its memory is stale.
- **List RUNNING NOW with process ids, log paths and each wait.** Say what each thing is waiting on.
- **Keep QUEUED in order so the next task needs no judgement.**
- **Name why each BLOCKED item is blocked and what unblocks it.**
- **List HELD work deliberately not shipped and who owes the decision.** The work is finished.
- **Put questions you cannot answer yourself under AWAITING <person>.**
- **Keep DONE to one line each, enough to prevent redoing it.**
- **Record EVIDENCE as measurements with their actual numbers.** See § Write down evidence, not just tasks.
- **List STANDING RULES a fresh reader would otherwise violate.**

**Use the same sections for work that isn't code.** `references/other-work.md` says how they map.

**Append decisions and their reasoning to `LOG.md`, never rewrite its history.** Include corrections and dead ends. Status answers "where are we"; the log answers "how did we get here, and what did we already rule out". Both are needed, in separate files.

**Optionally commit a how-it-works doc when the machinery is non-obvious.** Status and log are volatile; this durable doc belongs in version control and your routing file.

## The owner's view

**Give the owner a short status and the decisions that need them.** Use the Product Engineering workbench for an existing project. Link related proposal, plan and evidence records so the owner can decide without rereading a transcript. If the workbench is unavailable, keep the same information in `OWNER.md` beside the status and log.

- **Lead with the current milestone, completed work, active work and the next item.** Record the reason for each blocked item and who can unblock it.
- **Give each proposed decision its context and options.** Use `product_record` with `decision.add` for an open owner decision and link the existing evidence IDs. Keep one record per decision. The owner resolves it in the workbench.
- **Put an owner-only task in plain terms.** Include the file, view or setting it concerns, why the owner is needed, and what follows. Give the location for any required secret without asking the owner to paste it into the record.
- **Record the decision in the relevant durable project files.** Keep the selected option and its reason in the log. Reconcile answered and pending records before changing what is queued. A saved project decision does not grant runtime tool permission or permission to deploy.
- **Read back the state at a meaningful checkpoint.** Check before a phase boundary, after a compaction, and when the owner says they answered. Create a scheduled check only if requested and a scheduling capability is available.

Use the Product Engineering stage and checks already recorded for this project. Leave stage changes and check attestations to the owner. Build any progress report from the same verified status. The upstream `assets/owner-page.html` and `references/owner-page.md` document a separate vendor-hosted page and its storage protocol.

## The rule that makes it work

**Update `STATUS.md` on every state change.** Do it when a job starts, finishes, fails or gets published, a decision lands, or something becomes blocked. Not "at the end", not "when asked": the moment it changes. A status file that is 80% true is worse than none, because it is trusted.

**Keep status short enough to stay true.** If maintaining it is a burden, it is too detailed.

## Write down evidence, not just tasks

**Record measurements with their numbers and verdict, not the conclusion alone.** The highest-value lines are probe results, benchmark numbers, verdicts, costs, and "we tested X and it does not work". Losing task state costs a re-read; losing evidence costs money and credibility. You might re-run a paid experiment or restate a number from a summary and get it wrong.

## Where to put them

**Keep one pair per area of work, not per repository.** A repository with three unrelated efforts wants three pairs; three repositories serving one effort want one. The area is the unit someone would ask a status question about.

**Put volatile state where it survives without polluting the work.** A scratch or working directory is right. Cross-link from the log to the status, and from any long-lived doc to both, so a fresh reader finds them.

## Reading them after a compaction

**Read `STATUS.md` first, then skim the last few decisions in `LOG.md`.** Verify that a process listed as running is actually running.

**Do not trust the file over reality.** Reconcile, then fix the file. A stale status caught early is a small problem. Trusting it blindly is how you report a job finished when it crashed an hour ago.

## When NOT to use this

**Skip this for short sessions, single-shot tasks and one-context-window work.** The overhead is real and pointless there. Use it when a session will outlive its own memory. You can usually tell at the start from background jobs, queues, or a run measured in hours.

Each rule's origin, the case that taught it, is in `receipts.md` beside this file; read it when a rule's edge is unclear.

## How you can tell it worked

After a compaction, one read of the status board says what is running, what is blocked and on whom. Every line still matches what is on disk and what is running.
