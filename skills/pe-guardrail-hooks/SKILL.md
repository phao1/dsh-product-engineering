---
name: pe-guardrail-hooks
description: "An agent keeps breaking a rule ('it did it again', 'make this impossible', 'add a hook', 'my hook didn't fire'): make it a hook, permission rule or script."
user-invocable: true
---

# Guardrail hooks — rules held by code

## DeepSeek Harness

This skill is available through `skill({ name: "pe-guardrail-hooks" })` or the user's `/pe-guardrail-hooks` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**Put a recurring rule on the execution path that can enforce it.** Use `pe-agent-instructions` to decide whether an instruction, tool policy, or product-side check owns the rule.

## Choose the enforcement point

| Rule | DSH enforcement point | Check |
|---|---|---|
| Require approval before a specific tool action | A configured policy plugin on `tools/pre-execute` | The allowed action reaches the tool and the denied action has no effect |
| Deny a tool action across an agent scope | A scoped `ctx.tools.guard()` registration | A different policy cannot override the guard's denial |
| Enforce a product invariant for all callers | Validate in the product tool or API itself | Direct calls and agent calls both reject the invalid operation |
| Require an artifact or a verification step | A project test or release script that consumes its actual evidence | The gate fails with the evidence removed and passes when it returns |
| Restrict filesystem, network, or subprocess access | DSH workspace policy and its configured sandbox | Run a harmless denial canary from the same profile |

See the pinned [DSH tool extension guide](https://github.com/deepseek-ai/deepseek-harness/blob/687f282e8625c6b8d11ff58211a90524be2e4317/docs/cookbook/adding-a-tool.md) before writing a policy plugin.

## Define and verify the rule

1. Identify the affected action and paths, its caller, the reason to deny or ask, and a harmless look-alike. Cover equivalent paths through shell, MCP, browser or product APIs when applicable.
2. Choose the denied failure mode and an operator recovery path. Keep enforcement and diagnostics inside the active tool policy.
3. Add fixtures for a legitimate call, a rejected call, unexpected input and an unavailable policy dependency. Use structured input where available and treat shell text matching as partial coverage.
4. Run the fixture test, then verify a harmless allow and deny canary in the actual profile. Record the observed verdicts, the profile and the covered tools. A saved decision records intent and cannot satisfy a tool approval prompt.
5. Change profile policy or install a hook only when the request includes that configuration change. If the tool registry or deployment policy cannot express the rule, give the owner a verified project-side check and name the remaining gap.

## Bundled examples

`scripts/block_wrong_identity.py` and `scripts/guard_one_way_doors.py` are standard-library Python examples for vendor JSON hook protocols. Use `scripts/test_hooks.py` to exercise their parser behavior with fixtures. An existing, explicitly configured DSH Claude Code or Codex hook bridge can run a compatible command hook. Check the installed bridge's matcher, payload, verdict and failure rules before wiring it. For example, the Codex bridge's `PreToolUse` can deny but cannot prompt, and a failed hook can leave the agent running. Match the DSH tool name exposed by the profile, then run both canaries. Read `references/hook-contract.md` for standalone vendor behavior.

## How you can tell it worked

The intended harmless canary is denied in the active profile, the look-alike still runs, and the evidence identifies the paths the rule covers.
