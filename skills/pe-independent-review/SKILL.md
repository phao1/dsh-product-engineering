---
name: pe-independent-review
description: "Before 'ship it', a deploy or release, for 'an independent review', and after each fix until a round is clean: a fresh reviewer that never saw the build."
user-invocable: true
---

# Independent review — the gate before a change ships

## DeepSeek Harness

This skill is available through `skill({ name: "pe-independent-review" })` or the user's `/pe-independent-review` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**The session that wrote the code never clears it.** A fresh reviewer that never saw the build reads the change for what would block or break it. That separation applies at every size: a one-line fix gets a short round, never no round.

**Use a fresh reviewer with read-only access to the review subject.** A reviewer starts without the builder's conversation, previous findings, or draft verdict. A configured DSH reviewer preset can qualify when its tools and workspace access meet this bar. Confirm that it can read the relevant files, cannot write or act on real systems, and does not inherit connectors or saved memory. A separate fresh read-only session of the same model can qualify. Record the actual model, scope, and isolation you verified.

**Follow the product's review and release rules.** Use its documented reviewer, required review moments, release baseline, and severity bar when those are compatible with the active profile and the owner's authorization. Use another model family when authorized and available. Changing providers changes who receives the review subject, so use only an approved reviewer and disclose the actual choice.

**Record an unavailable independent review as pending.** Prepare the brief and file scope for an authorized reviewer and report the blocking capability. A builder self-check can still establish test results and identify defects.

**Verify findings yourself and rerun the project's gate yourself after every fix.** The loop is fix → rerun the project's test gate yourself → fresh review of the changed state → verify every finding against code yourself → fix → repeat.

**Treat findings and their severity labels as claims, not results.** Triage below is mandatory; it is the part that most often goes wrong.

## When

- **Review before every release, however green the tests are.** A release without an independent pass is not a release.
- **Review before every push to a branch that deploys.** When users receive the push, "just push it" requires a round first. The push closes the round (§ Running a round beside the next stage).
- **The first push goes only where the owner named.** Every URL from `git remote get-url --push --all origin | sed -E 's#//[^/@]*@#//#'` must name that repository. The `sed` removes any username or token. If any URL differs, push nothing and ask.
- **Review again after fixing anything a round found.** A fix is unreviewed code, and fixes produce the worst defects. Never report readiness from a round that found something, however small or confidently fixed.
- **Consider an optional round at a stage boundary inside long work.** This cheap pass brings findings while the code is warm instead of all at the end.

## The subject: computed from git, and it narrows after round 1

**Compute the subject from git, including everything unreleased.** A prose description can leave an unapplied migration or untracked file unreviewed. Round 1 takes everything unreleased, committed or not: last release to `HEAD`, plus the working tree.

```bash
git log --oneline $RELEASED..HEAD               # the unreleased commits
git diff $RELEASED...HEAD --stat                # its shape
git status --porcelain -uall                    # and anything uncommitted, file by file
```

**Review the status before building the subject.** Include uncommitted work that belongs to the task using an explicit file list. Leave out unrelated files, credentials, private fixtures, local config, and untracked symlinks. If a necessary area cannot be shared with this reviewer, record it as unverified and use an authorized reviewer for that area.

**Use the repository's last released state as `$RELEASED`.** It may be production branch `origin/<prod>`, a release tag or the deployed commit. For a first release, review all source that will ship, including inherited code and applicable history. Check the material for secret exposure before it leaves the workspace. An upstream tag does not establish that this product has shipped.

**Never narrow the range by hand to make it fit.** Round 1 includes already-pushed code: when pushes deploy, that code is exactly what users run. A range too large for one round is split, never shortened, in one of two ways:

- **Split by commits when the history falls into stages.** Give each round a contiguous slice and the rest of the range as context, oldest first. Each later round reads earlier slices for interactions. This fits a few build stages.
- **Split by surface when the history does not partition.** This fits a first release covering the whole product, or commits that each touch everything. Each round takes the whole range and reads its assigned area in full, with other areas named as context. Examples are public surfaces; data, permissions and money; and member screens. Together, the areas cover every changed file. Area rounds read one still snapshot and run in parallel, each with its own brief and output file so concurrent rounds do not all read the last brief written.

**Narrow every later round to commits since the previous round.** Give the remaining unreleased range as context to read for interactions. Naming new code is scoping, not steering. Re-reviewing cleared code adds time and pre-existing noise while burying new findings. Passes find bugs, so cheap rounds beat thorough ones.

**Bring old code into scope only where the change makes it newly reachable or newly wrong.** Say this explicitly in the brief; interactions hold serious findings. Keep both kinds of pass: a whole-range review sees composition that per-commit rounds cannot.

**Scope the subject by what a reviewer must read, not by file count, and keep generated prose out of it.** Give generated docs as context for code questions, not review subject; prose can exhaust a round that fits the code and tests.

## Run a review

1. Run the project test gate. Identify the reviewed base, head or exact working snapshot, and the files included. Include a cumulative diff when merge commits could hide conflict resolutions. Preserve interactions outside a narrow diff as explicitly scoped context.
2. Use a separate immutable checkout when building continues in parallel. A permitted detached worktree at the exact commit gives the reviewer a stable tree. Keep its resource paths inside the assigned workspace. For uncommitted changes, hand off a checked diff and a scoped snapshot of the needed files. Exclude private material even when the tool could access it.
3. Send the brief to a fresh reviewer whose tools and accessible files meet the requirements above. When the active DSH profile offers `subagent`, use it only with a verified reviewer preset. Confirm actual reads and report the evidence, model, and isolation. An empty or short clean claim with no successful reads leaves the round unverified.
4. Read the findings yourself, test their triggers, and record each disposition. Rerun the gate and review the changed state after a fix. Keep the whole release range in view before promotion.
5. If a push is authorized, verify the destination and use the exact commit cleared by the round. Use `pe-release-gate` when the push publishes or deploys. Clean up a review worktree you created when its job ends. Check for links or shared dependencies before removal.

The bundled `scripts/review.py` is a legacy vendor adapter. It assembles Git history and working-tree data, can read untracked files and symlinks, and selects an external CLI by default. Keep it dormant in DSH. Use the scoped review workflow above.

## Writing the brief

**Write only these five parts, in this order, to avoid steering.**

1. Say what the product is in two sentences. Name its binding spec files, such as agent instructions and architecture docs. Explain how its pieces fit: trust boundaries, ownership and where writes go. A diff alone cannot show interactions.
2. Paste the subject from the git commands above, naming the earlier range as context.
3. Give the usage model: who uses which surface, how many and at what moment. State what stays serious however exotic the trigger. For most products: another tenant's data, private data on a public surface, lost or duplicated writes, anonymous access to a member capability. State what does not block, such as cosmetic divergence the next refresh fixes. When information is hidden from users, explain from whom, why, what honest users might expose accidentally, and what requires deliberately defeating their own measurement (§ Triage).
4. Ask what would block or break this release. Label every finding INTRODUCED or PRE-EXISTING. Require the literal triggering sequence and who performs it. A finding unable to name its trigger usually has none; requiring it exposes over-claiming before a fix is briefed.
5. Request a numbered list: claim, `file:line` evidence, what to change. Keep it terse, without praise, ranked. End with those most likely to bite.

Do not include earlier findings, suspected files, your argument for the design, or a request for approval. A reviewer asked whether it approves will tell you it approves.

## Triage — the part that goes wrong

**Question zero, before any other: say in ONE SENTENCE what actually goes wrong for the person.** If it does not sound bad read aloud, there is nothing to fix. "You land on one of your own items that a filter was hiding" dies unaided. The reviewer's severity label is part of its claim, and taking one at face value is how a clean release grows two invented P1s.

**does anything cross a line the person cares about?** Examples are another tenant's data, private data on a public surface, another user's private content, disappearing work, lost writes or anonymous access to a member capability. If everything already belongs to the person and stays visible, it is a surprise; a surprise is polish. Distrust a real mechanism with a scary label and speculative harm. Ask whether the person can see where they are. Builder reports and reviewer priorities are both claims; neither model decides.

**Require literal steps, permitted execution and a person with a reason.** A finding that cannot answer these three questions is not a finding:

1. **What exact sequence produces it?** Not "an attacker could": literal steps in order.
2. **Does this system permit that sequence?** Check the code that must allow it. This is where most die.
3. **Who does it, and why?** If it needs someone already holding the owner's session on the owner's own screen, they had the screen.

**A layout or performance claim is settled on the running build, not by re-reading the file — in either direction.** Stylesheet arithmetic may be right while the conclusion is false. A flex item's automatic minimum is its content; cells wider on paper than their container can shrink rather than overflow. "Obviously it shrinks" is as speculative as "obviously it overflows": measure before accepting or rejecting. Measure visible text against neighbours in the same column, not the named container. The defect itself can produce matching box edges. Measure performance on both builds, with the baseline built from `HEAD` in its own worktree. Let the numbers retire the fix.

**When findings cluster, look for one false premise underneath before fixing any of them.**

**Rank by what it costs this product, not by where it sits in the list.** Read user and business impact: who sees it, how many and at what moment. A widely seen instruction failing at a critical moment can cost more than its mechanism suggests. A recoverable flow one admin meets once can cost less than its label. When a rule hides information from product users, grade further probes by harm to an honest user. A probe usable only by someone deliberately defeating their own measurement is Low. They hide information from themselves, then seek it out.

**A fix has a price, and the price compounds.** A confirmed defect is still a decision. Watch for rounds getting narrower, each trigger needing more actors or more precise interleaving. That finds what code permits rather than what users hit. Ask aloud what the fix costs to understand next year, by someone who was not here. State the residue's price plainly. If acceptable, write that down and stop. Ask whether the fix replaces a mechanism or adds one. Replacement is usually right; a special case per round compounds the problem.

**Accepting a finding is a legitimate outcome.** A rarely-wrong rule somebody can hold in their head beats an always-right one nobody can.

**A fix that did not need to happen is itself a defect.** Weigh branches, permanent complexity and new review surface against the occasional actual harm. Run the fix's regression test on the tree before the fix. If it passes, the finding was false: revert the fix and keep the assertion. Apply `pe-test-harness` for that rule.

**Prefer removing the rare case to supporting it.** Constrain input, refuse the state, drop the option or choose a default that cannot produce it. An unreachable case needs no code, test or comment and cannot interact with the next fix. Ask whether it must exist before writing its branch. Only then weigh fixing against accepting the residue.

**Beware the fix that opens a door.** Two conditions right alone can be wrong together. Continue the loop past the fix that felt final.

**Fix the class when defects share a cause.** After the unsteered round, run a separate targeted check for related paths and keep its findings separate from the independent report.

**When a repair writes a field that says who decided, scope it by the subject** (this participant, this item), never by the rows' current state. A state filter skips exactly the rows another actor already decided.

**When the actor is an attacker, ask whether the finding adds a capability the attacker does not already have in that position.** A mechanism granting nothing new is a description, not a vulnerability; question 2 above passes too easily here. Watch for reasoning from one entry point without reading neighbouring rows in the permission table.

**Improve the average; the exception is the person's work.** Polish serves the case most people meet, letting the rest degrade honestly with geometry intact. Use a same-size placeholder so nothing jumps when the real thing arrives. Anything losing or duplicating what a person made gets full treatment, however rare.

**Say it plainly when a round is empty after triage.** "Three findings, none survive the usage model" is a result, expected on a well-built change.

**Read a clean round's argument, not only its verdict.** Code cited to prove safety can expose the same defect one surface over.

**When a round changes one user-facing sentence, read its neighbours and the assertions around its pin.** A repair can distract from a nearby claim it just made false.

**Search every doc when a state they all describe changes.** When production exists or a feature goes live, find old-state phrases and fix them in one pass. Do not stop at the line the round named. When a rule is repealed, find sentences that argued for it: comments, fixtures and doc paragraphs. Ask what each still holds up.

**Repair a drifted pair by copying the sentence that is right into the place that is wrong.** Never write a third version; pin their agreement in the same change.

**When a repair delegates behaviour to the platform, enumerate what the old code decided.** A deleted handler takes its judgement with it; the diff shows only deletion. When replacing a control, inspect its odd attributes: `aria-disabled` where `disabled` would do, or a seemingly redundant handler. Grep deleted lines for the comment arguing for them.

## The stopping rule

**Stop at no INTRODUCED finding above Low and no High or Critical of any age.** Fix High and Critical now, regardless of age. Small releases reach that bar fastest; later releases review only their own commits.

**When one mechanism draws findings two rounds running, stop patching it.** Repeated inverse defects in one area mean the design is wrong. Before the next round, choose one option in writing:

- Cut it: revert to before the first fix, then ask once what signal the design is missing.
- **Redesign it once.** Write the redesign before building it. It earns that attempt only by removing machinery. A redesign more elaborate than what it replaces repeats the problem.
- Pause it: when one surface keeps drawing new Highs while the rest of the change is clean, propose to the owner, at the second such round, that it ships behind a switch that is off by default, its open findings in the backlog with the trigger that reopens them, and the next round scoped to what is reachable with it off.

Scale this by whether the work was requested. Apply it hardest to unrequested hardening, lightest to a feature the owner asked for by name.

**Budget for a fix commit's own round in ingest, queue and concurrency code.** When planning, allow for that tendency.

**Record pre-existing findings with their deferral reason and a revisit trigger.** Include the trigger because it is what gets the finding fixed. Use the repository's backlog file or issue tracker; ask if it names none. High and Critical are the exception: fix them now, regardless of age. Never silently drop a finding. The release summary states each round's finding count and what happened to each, including those not worth fixing and why.

**Number rounds in one sequence per repository.** Cite the number wherever the outcome lands: fix commit, backlog row, merge and release record.

**Verify every finding against code by hand before acting.** Cited line numbers are claims too. Rerun the project's tests yourself after every fix; "it says it passes" is a claim, never a result. Record disproved findings as wrong beside confirmed ones, making the next round's hit rate legible.

Each rule's origin, the case that taught it, is in `receipts.md` beside this file; read it when a rule's edge is unclear.

## How you can tell it worked

The last round came from a fresh reviewer given only the mechanical range and found no introduced finding above Low. No High or Critical of any age is open, and every earlier finding was checked against code before being fixed or dismissed.

## Not this skill

**Bring in a peer early for design or arguing a decision through.** Apply `pe-codex-agents`, `pe-claude-agents` or `pe-grok-agents`; this skill reviews what was built.

**Use the related skills for CLI mechanics, delegation and reading defects.** Apply those three skills to drive Grok, Claude Code or Codex from another agent in any role, including reviewer. Apply `pe-delegation` for briefing and verifying any delegate, and `pe-code-review` for reading code for defects.
