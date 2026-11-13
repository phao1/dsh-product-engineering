---
name: pe-grok-agents
description: "'Ask Grok', 'have Grok build or review this': drive the Grok CLI headless from another agent as a peer, builder or fresh reviewer."
user-invocable: true
---

# Grok agents — the Grok CLI headless as a partner

## DeepSeek Harness

This skill is available through `skill({ name: "pe-grok-agents" })` or the user's `/pe-grok-agents` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**Use Grok as a named external collaborator.** This workflow requires a configured Grok provider or the `grok` CLI and authorization to send the task material to that provider. Check the actual available integration, model, permissions and account. If Grok is unavailable, state the missing prerequisite and prepare the brief for the owner. Use another provider only when the owner already authorized that destination.

## Choose a mode

| Mode | Give the delegate | Verify on return |
|---|---|---|
| Peer consultation | The goal, primary evidence, current draft, and the uncertainty you want challenged | It addressed the question and grounded its claims |
| Builder | A separate allowed worktree, goal, binding decisions, test requirements and scope | The actual diff, what changed, and checks you can repeat |
| Independent reviewer | A fresh read-only session, exact sanitized review scope, and a neutral brief | Successful reads, triggering steps, file references, model and isolation |

Apply `pe-delegation` to prepare the brief. Use `pe-independent-review` for the release review loop and its stopping rule. Keep production actions, credentials, and publication with the authorized operator. Share only the files and evidence needed for this task.

## Open, continue, and verify the session

Write long briefs to an approved scratch file. Include the outcome, who it serves, its binding constraints and how to verify the result. Carry the job map and design direction when the delegate changes screens. Provide repo instructions by path when the reviewer needs a binding spec.

Continue a peer discussion by its recorded session ID when you are resolving an open question. Ask it to address the remaining critique or dispute. Start a fresh session for each independent review. Confirm the latest result on disk and rerun the named checks. Distinguish validation that was blocked, planned or performed.

## Optional standalone integration

Use a configured provider or an operator-managed CLI whose tools and data scope can be verified. Check the installed version's help for approved read-only usage. For a standalone reviewer, a shell or other side-effecting tool must be absent. Verify that memory, connectors, compatibility session imports and automatic context are disabled when they would expose the builder's work or unrelated data.

Some CLI versions produce a short successful exit without reading any file when their tools are blocked. Require evidence of actual reads, scope and model before counting a review. For a consultation, resume by its exact session ID and repeat the access restrictions. If the CLI cannot perform the authorized mode under the available permissions, report it unavailable and prepare an operator handoff.

Keep the host's configured authorization intact. An installed CLI, script, or signed-in account establishes availability. The user-approved scope determines which material may be sent and what the delegate may change.

Each rule's original observations and failure cases are preserved in `receipts.md`.

## How you can tell it worked

The report identifies the Grok model and session and cites the files actually read. A builder's output stays within the assigned worktree and the coordinator can rerun its checks.
