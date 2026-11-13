---
name: pe-embedded-agents-agent-sdk
description: "Only when the Agent SDK is asked for, an agent needs Claude Code's own tools, or the app already runs it: embed Claude agents in a Next.js app with the Agent SDK."
user-invocable: true
---

# Embedded agents — Claude Agent SDK

## DeepSeek Harness

This skill is available through `skill({ name: "pe-embedded-agents-agent-sdk" })` or the user's `/pe-embedded-agents-agent-sdk` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

The Anthropic SDK, `.claude/agents/` layout, and SDK tool names in the examples belong to the application you are building. Keep the app's Anthropic account and development configuration separate from the DSH session. Run a paid live test only when the task authorizes that use of the app's test environment.

**Use the Agent SDK when the agent needs the Claude Code engine.** Also use it when the product already runs it. The SDK starts that engine as a subprocess with built-in file and shell tools and Claude Code's own system prompt. It loads skills and MCP and needs a long-lived Node host. Both embedded-agent skills run the same agent directories. The `pe-embedded-agents-messages-api` skill is the default for a new product. It uses the Anthropic SDK's tool runner in the app's own process on any Node host, with only the wrapper's tools and no subprocess.

**Read the product's own agent instructions before changing its embedded agents.** Start with its root `AGENTS.md` or `CLAUDE.md`, and tell any subagent spawned for this work to read it too. Its rules on secrets, environment variables, validation, callers, tests and release apply here. This skill adds how to run Claude agents inside the app. Read `reference/playbook.md` before changing the wrapper's contract or explaining it in depth. It holds the full playbook and the measurement behind every option.

**Keep request, caller, storage and UI ownership in the app.** The agent owns reasoning and tools. An agent is a directory, `.claude/agents/<name>/`, with `AGENTS.md` as its only instruction file. It may also hold `knowledge/`, agent-local skills in `.claude/skills/`, and `.mcp.json`. One wrapper function, `askAgent`, runs any agent. No agent name appears in code.

## 1. First use: install the wrapper

**Search for `askAgent` before installing another wrapper.** If it exists, skip to § 2. Otherwise:

1. **Create only the smallest requested app when none exists.** Use Next.js App Router in TypeScript, which these files target. Add nothing unasked for: no database, sign-in or billing for a local prototype.
2. **Install the missing dependencies.** Run `npm i @anthropic-ai/claude-agent-sdk zod server-only` and `npm i -D vitest`.
3. **Copy the wrapper, route and tests, changing only import paths.**

   | From this skill | To the app |
   |---|---|
   | `templates/agent.ts` | `src/lib/agent.ts` — the wrapper |
   | `templates/route.ts` | `src/app/api/agents/route.ts` — `GET` lists agents, `POST` streams one |
   | `templates/agent.test.ts` | `tests/unit/agent.test.ts` — the contract, inside `npm test`, no model call |
   | `templates/agents.live.test.ts` | `tests/live/agents.live.test.ts` — every agent against the real model |

   The tests import `@/lib/agent`, so Vitest needs the same `@` alias as `tsconfig.json`. The live test gets its own Vitest config (include `tests/live/**/*.live.test.ts`, `testTimeout: 180_000`, `fileParallelism: false`) and a script, `agents:live`. It costs money, so it stays out of `npm test` and the gate.
4. **Set each required secret per environment and never commit it.** Set `ANTHROPIC_API_KEY` and every secret referenced by an agent's `.mcp.json`; apply `pe-environments`. On a developer's laptop the SDK falls back to their own Claude login when the key is absent; a deployed product always uses the key.
5. **Keep the contract.** Every option in `agentOptions()` exists because an SDK default failed a measurement (playbook § 9). Change one only after re-measuring it.

## 2. Add an agent

1. **Create the agent directory and fill in its instructions.** Run `node <skill dir>/scripts/new-agent.mjs <name> [--knowledge] [--mcp]`, then fill in `AGENTS.md`: role, sources, output format, refusals. A fixed sign-off line is the cheapest live-test proof that the instructions are in force.
2. **Keep knowledge and automatically discovered skills inside the agent directory.** Put knowledge in `knowledge/*.md`, and tell the agent in `AGENTS.md` to answer only from them. Agent-local skills are found automatically in `.claude/agents/<name>/.claude/skills/<skill>/SKILL.md`.
3. **Allow only MCP tools the agent's job needs.** Put approved servers in the app agent's `.mcp.json` with secret references such as `${VAR}`. Inspect the endpoints, executable and arguments before discovery, which can connect to a service or launch a local process. From the app root, run `node --env-file=.env <skill dir>/scripts/discover-mcp-tools.mjs <name>` using the app's scoped development configuration, then restrict each server's `allowedTools`. Anything unlisted is denied. Commit the agent's configuration only after checking that it contains references in place of secret values. If the project has a root-only ignore rule for `.mcp.json`, anchor that rule to the root.
4. **Discover agents from their directories rather than hardcoding the UI list.** `listAgents()` finds the directory, `GET /api/agents` returns it, and the UI's picker shows it when users choose between agents. Fix a UI that hardcodes that list.
5. **The instruction file is always `AGENTS.md`.** Asked for another name, create `AGENTS.md` and say why: the wrapper loads only `AGENTS.md`, and the SDK loads some other instruction files on its own, which would give the agent two sets of instructions.
6. **Add a live test for each promise worth pinning.** Examples include citing, refusing and answering only from its files. Put it beside the generic test.

## 3. Examples — only when asked

**Copy finished examples only when asked for or described.** The `examples/` agents are: answering only from local product-management knowledge files (`knowledge-agent`), or live-web research through Perplexity with citations (`research-agent`). Copy `examples/<name>/` to `.claude/agents/<name>/` and `examples/<name>.live.test.ts` to `tests/live/`. `research-agent` needs `PERPLEXITY_API_KEY`. Otherwise, never copy them.

## 4. The chat UI

**Build the chat UI for this product and its agent flow.** There is no template. It must do the following:

- **Fill the picker from `GET /api/agents` when users choose agents.** A product may run one front agent and show no picker; the route still checks the name against `listAgents()`.
- **Send the conversation to the route and read server-sent events.** `POST { agent, prompt, history }` to `/api/agents` and read: `{ text }` chunks, then `{ done, agent, metadata }` or `{ error, agent }`. The parser is in playbook § 5.
- **Store the agent on every message; identify replies with several agents.** When there is more than one agent, show it on each reply, so the reader always knows which agent answered. History is the conversation so far, kept in client state unless the product asks to persist it.
- **Render agent output as plain text or sanitized markdown.** Never render raw HTML: it is untrusted text, like anything a user typed. Show an `error` event instead of spinning forever.

## 5. Explaining routing and the tool boundary

**Validate the requested agent before routing it to the wrapper.**

1. UI
2. `POST /api/agents { agent }`
3. the route validates the body and requires the name to be in `listAgents()`
4. `askAgent`
5. `agentOptions()` accepts only a plain directory name and resolves `.claude/agents/<agent>/`
6. `query()` starts the Claude Code engine with that directory as `cwd` and its `AGENTS.md` appended to the system prompt
7. events stream back.

**Keep every measured layer of the tool boundary in force.** See playbook § 9:
1. **Expose only built-in tools on the allowlist.** In `tools`, only those built-ins exist — `Read`, `Glob`, `Grep` by default. `Bash`, `Write`, `Edit` and `WebFetch` do not.
2. **Allow an MCP tool only when its server lists it.** With `permissionMode: 'dontAsk'` and `allowedTools`: an MCP tool runs only if its server's `allowedTools` in `.mcp.json` lists it.
3. **Load only the agent's own MCP servers.** `strictMcpConfig`: only the agent's own `.mcp.json` servers load — nothing from the developer's or the server's user configuration.
4. **List only the agent's own skills.** `skills` enforces this.
5. **Keep readable files inside the agent directory and exclude credentials.** The sample PreToolUse hook checks path text and blocks direct traversal and `.env` requests. A symlink inside the directory can still point elsewhere. For deployment, give the SDK process a filesystem view limited to reviewed agent files, reject symlinks or verify their resolved targets, and test attempts to reach external files with Read, Glob and Grep.
6. **Cap the run by turns and budget.** Use `maxTurns` (10 by default) and `maxBudgetUsd`.

## 6. Before it leaves localhost

- **Choose a long-lived Node host before the agent leaves localhost.** The SDK runs the Claude Code engine as a subprocess, so an agent cannot run in a serverless function such as a Netlify Function (playbook § 7). A product whose site deploys there needs a second, long-lived Node host (a container or VM, such as Railway), chosen before the agent goes beyond localhost; write its deploy procedure into the product's docs the first time it is used. `next dev` needs nothing.
- **History is a client claim.** `templates/route.ts` accepts `history` from the client, `assistant` turns included, and `composePrompt` turns it into a "Previous conversation" preamble — so a client can forge earlier turns, the agent's own included. That is acceptable for a read-only agent, which can only be talked into saying something to the person forging it. Before any tool acts on the caller's behalf, keep the transcript on the server and stop reading it from the request.
- **Resolve the caller and cap cost before opening the route.** Before anyone but the developer can reach the route, resolve the caller there (who they are, which workspace, which permission: `pe-saas-authorization`) and set a per-actor limit and a `maxBudgetUsd`.
- **Run live tests before releasing any agent, prompt or model change.** Run `npm run agents:live` before any release that adds or changes an agent, its prompt or its model, record the run in the product's test-coverage map (which test proves what, and when it last passed), and describe each agent in its automation doc: what it may read, the exact tools it may call, and what the app enforces around it (`pe-shipping-artifacts`).

## How you can tell it worked

The agent runs on the deployed host, not only on localhost, uses only the tools it was given, and the live agent suite passes against the real model.

## Running the scripts

**Run these scripts from the app's repository root.** Substitute the skill base directory shown by DSH for `<skill dir>`. The scaffold script writes app files. The discovery script uses the SDK installed in the app and inspects the configured MCP servers.
