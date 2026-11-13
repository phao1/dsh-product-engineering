---
name: pe-handover
description: "Write the handover a fresh session starts from: the objective, what is true now, the evidence actually obtained, what is left, the open decisions and the next concrete action, reconciled with the disk first. Start with /pe-handover."
user-invocable: true
disable-model-invocation: true
---

# Handover — what the next session starts from

## DeepSeek Harness

The user starts this workflow with `/pe-handover` at the beginning of a message. Treat any following text as scope or context. When this workflow calls for another `pe-` skill, load it by name with `skill` if model-invocable. For `pe-start-here`, `pe-ship-check`, `pe-handover`, and `pe-retro`, give the user the corresponding slash invocation. Resolve bundled resources from the skill base directory and use the current workspace for project inputs and outputs.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**Write the one note the next session reads first.** The session is ending, or its context is; work continues tomorrow, in a fresh session, or with another agent. Start that session from what is true rather than what this session remembers.

## Invocation

Start the message with `/pe-handover` and add any scope or context on the same line.

## Steps

### 1. Reconcile with reality first

**Check what this session believes against reality before writing a word.**

- **Check the disk and name uncommitted work as uncommitted.** Read `git status`, the branch, commits made this session, and files the work touched.
- **Check every background job, server, watcher and build this session started.** Each is still running, finished with its exit code read from its log, or gone.
- **Correct project state files where the disk contradicts them.** Check the plan's status, status board, backlog and earlier handover; correct those lines rather than copying them.

**An inherited report is a claim, this session's own memory included.**

### 2. Write what the next session needs

| Section | Holds |
|---|---|
| Objective | what the work is for, in a line, and who asked |
| Where it stands | what is true now: built, committed, pushed, deployed, each said plainly |
| Evidence | what was actually run and observed: the command, its exit code, the number, the verdict. Not what was intended. Anything unverified says so |
| Left to do | in order, each small enough to start on |
| Open decisions | each with its options, a recommendation, and whose decision it is |
| Where things are | branches, worktrees, files, logs, URLs, processes still running and how to stop them |
| Next action | one concrete first step: a command to run, a file to open. Never "continue" |

**Keep it short enough to stay true, preserving the evidence.** Evidence costs most to lose. A re-run experiment costs money; restating a number from memory is how a wrong one reaches the owner.

### 3. Put it where the project keeps such things

**Use the project's own handover convention before creating a new file.** Use its status board, plan's status lines or existing handoff file. With none, keep one `HANDOVER.md` at the repository root, rewritten in place each time. It says what is true now, not the history.

**Use the `pe-flight-deck` skill for hours, multiple sessions or background jobs.** That work wants its status board and log instead of a single note. A few lines are enough for a short session.

**Name where secrets are kept without putting them in the handover.** No keys, tokens, passwords or connection strings.

### 4. Tell the owner how to start the next session

**End with the next session's starting line and anything left running.** For example: *Read `HANDOVER.md` and start from its next action.*

Each rule's origin, the case that taught it, is in `receipts.md` beside this file; read it when a rule's edge is unclear.

## How you can tell it worked

A fresh session given only the note can say what the work is for, what is verified and what is not, and run the next action without asking what happened.
