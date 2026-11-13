---
name: pe-windows-agent-shell
description: "A coding agent on Windows: Git Bash path rewriting, PowerShell quoting and encoding, CRLF. Use when output comes back garbled, or it works here and breaks there."
user-invocable: true
---

# Windows agent shell — traps, and the works-here-breaks-there class

## DeepSeek Harness

This skill is available through `skill({ name: "pe-windows-agent-shell" })` or the user's `/pe-windows-agent-shell` invocation. When the workflow needs another `pe-` skill, load it by name if model-invocable. The user starts `/pe-start-here`, `/pe-ship-check`, `/pe-handover`, and `/pe-retro`. Resolve bundled resources from this skill's base directory. Read and write project files in the current workspace.

Write explanations and project artifacts in the user's requested language. Preserve code, paths, tool names, and policy identifiers. Use the tools and permissions the active DSH profile exposes and record any check that could not run.

When Product Engineering tools are available and the work belongs to a project, find it with `product_list({})` or use the supplied project ID. Read it with `product_get({ projectId })` before acting on its state. Use `product_record({ projectId, expectedRevision, command })` to record only relevant drafts (`artifact.save`), observed sources (`evidence.add`), or proposed owner decisions (`decision.add`). Use the revision from the latest project read and reconcile conflicts before retrying. Link real sources and report what you observed. The owner resolves decisions, attests checks, and advances stages in the workbench.

**When something works here and breaks there, suspect the environment you did not measure.** A Windows coding agent runs through Git Bash, PowerShell or cmd. Each splits arguments, expands characters, converts paths and decodes text differently. A command right in one can pass with a different meaning in another.

**Hold the invocation constant before attributing a change to configuration.** The shell, CLI version, path spelling and line endings are part of the invocation. Every version-specific line carries its version and observation date. Vendors change these monthly; `§ Re-verify` explains how to retest.

## First, know which shell runs the command

- **Claude Code's Bash tool on Windows uses Git Bash when installed.** Git Bash is MSYS2. Without Git for Windows it uses PowerShell instead (2.1.120), and with the PowerShell tool enabled PowerShell becomes primary (2.1.126; changelog, read `2026-10-24`).
- **Shell-form hooks use Git Bash, or PowerShell when Git Bash is missing.** Cursor runs hook commands through PowerShell; Codex takes a separate `commandWindows`. Apply the `pe-guardrail-hooks` skill for the hook side.
- **PowerShell 7 is a separate install and is often absent.** Windows PowerShell 5.1 (`powershell.exe`) ships with Windows; PowerShell 7 uses `pwsh`. A script or instruction saying `pwsh` fails where it is absent.
- **Measure the same arguments in the same shell, rather than reasoning.** Run `python <skill dir>/scripts/probe_argv.py <the same arguments>`. It prints exactly what the program receives and which encodings its pipes use.

## Paths

1. **Forward slashes, always, in anything a bash shell will read.** Bash treats `\` as an escape. Write `C:/Python313/python.exe`; Windows accepts it. Backslashes also fed Claude Code's Windows command analyser and caused permission prompts (observed `2026-08-16`).
2. **Uppercase the drive letter for any tool that takes its root from the working directory.** Use `C:/work/app` rather than `c:/work/app` with `npm --prefix`. On Vitest, a lowercase drive can give `No test suite found`, zero tests and exit 1 (observed `2026-08-22`). Keep the command shape constant when comparing runs: changed shapes can look like a worker-count cliff or a broken suite.
3. **Prevent Git Bash from rewriting leading-slash arguments passed to native programs.** It rewrites any argument starting with `/` into a Windows path before the program sees it. `gh api /repos/owner/name` fails with `invalid API endpoint: "C:/Program Files/Git/repos/owner/name"`. `--flag=/etc/x` arrives as `--flag=C:/Program Files/Git/etc/x` (verified and observed `2026-10-24`, Git 2.49.0, gh 2.100.0). Drop the leading slash (`gh api repos/owner/name`) or set `MSYS_NO_PATHCONV=1` for that command.
4. **Convert Git Bash's `/c/x` paths before Windows programs open them.** Git Bash spells `C:/x` as `/c/x`, which Windows programs can't open. Convert paths read from commands (`/c/x` → `C:/x`). Claude Code hook-input file paths arrive with backslashes even under Git Bash (docs, read `2026-10-24`); normalize before comparing.
5. **A generated file written with the host's separators must not be tracked.** Untrack it, don't commit one OS's copy. A sync-generated package manifest can use native separators that the other platform's compiler rejects as invalid escapes. The trap is tracking the generated file at all.
6. **A junction makes a delete reach somewhere else.** `npm --prefix <worktree> install` can create a package junction to another checkout when run from a checkout supplying a package the worktree depends on. Recursive deletion of `node_modules`, or `git worktree remove --force`, goes through that junction. Run installs with the target as the process's working directory. List `node_modules` for junctions before deleting; remove the junction itself first. `rmdir` on the link doesn't follow it. Then run `git worktree remove` without `--force`.

## Arguments and quoting

1. **Backticks inside `git commit -m "..."` are command substitution.** Backticked words execute and are replaced by their output, usually nothing, without warning. See § Commit messages for the safe spelling.
2. **PowerShell splits a bare `-c.foo=bar` token in two.** Windows PowerShell 5.1 does this too (reproduced and observed `2026-10-24`, 5.1.26100): `["-c", ".a.b=c"]` bare, `["-c.a.b=c"]` quoted. Quote it, and pin the quoted spelling with a test. A matrix can half-break and look finished: check the assets, not the run. A flag that has never been passed before has never been tested.
3. **Judge native PowerShell calls by `$LASTEXITCODE`, with stderr non-fatal around them.** Under `$ErrorActionPreference = "Stop"`, Windows PowerShell 5.1 turns redirected native stderr into a terminating error. Reproduced `2026-10-24` (5.1.26100): an exit-0 program writing one warning, called with `2>&1`, ended the script with `NativeCommandError`.
4. **In PowerShell, an environment variable set to an empty string is deleted.** `$env:DATABASE_URL = ""` removes it, so a loader such as dotenv fills it back in from `.env`; a supposedly database-free run reaches the configured database. Bash's `DATABASE_URL= cmd` passes an empty value instead (reproduced and observed `2026-10-25`, 5.1.26100). Set a single space when the code trims values to absent, or pass an explicit flag. When an attempt may have touched a real system, say so in the handoff.
5. **Run PowerShell scripts using the configured interpreter and permitted execution policy.** Pass the script with its file flag and give long-running operations a suitable DSH job timeout when supported.

## Encoding and line endings

1. **Never edit a UTF-8 file through Windows PowerShell 5.1's `Get-Content`.** It decodes with the ANSI code page. `(Get-Content f -Raw) -replace 'a','b' | Set-Content f -Encoding utf8` gives each `§` a stray `Â`. It turns every `—` into `â` `€` `”`; `-Encoding utf8` makes the write look safe, but the damage is on the read. Reproduced and observed `2026-10-24` (5.1.26100): the write also adds a UTF-8 BOM and trailing CRLF.
   - **Edit with the agent's own tool and pass CLI text as a file.** Use `--body-file` or `-F body=@file`, which reads bytes.
   - **Detect encoding damage and line endings with `check_text.py`.** Run `python <skill dir>/scripts/check_text.py <files>` to flag mojibake, BOM, CRLF and invalid UTF-8.
   - **Restore the last good version and redo the edit.** Use `git checkout <good-ref> -- <file>`. Don't reverse double encoding: CP1252's 0x80–0x9F range doesn't round-trip, so reversal loses characters.
2. **Configure Python's piped text as UTF-8 explicitly on Windows.** Python otherwise reads and writes pipes in locale-dependent `cp1250` or `cp1252`. `PYTHONUTF8=1` uses `utf-8` (observed `2026-10-24`, Python 3.13.1). In piped scripts, reconfigure stdout and stderr to UTF-8 and decode stdin as UTF-8 bytes, or set `PYTHONUTF8=1`.
3. **A tool or a delegate can rewrite line endings behind a clean diff.** `core.autocrlf` can normalize CRLF on commit while leaving the working tree wrong despite `.gitattributes` specifying `eol=lf`. Source-anchored tests can fail in a file the batch never touched, misleading a delegate into blaming the checkout.
   - **Check tracked working copies with `git ls-files --eol | grep w/crlf`.** It lists endings differing from the index. Use `check_text.py` for untracked files; `grep -c $'\r'` is not reliable under Git Bash.
   - **Fix CRLF with `check_text.py --fix-crlf <files>`, which changes nothing else.**

## DSH shell and argument boundaries

**Check the active DSH profile's shell and working directory.** Confirm them with a harmless command or the profile documentation. Keep text in a UTF-8 file and pass the filename as one argument. Use the dedicated filesystem and search tools for reading and searching. Use a tool's explicit directory option when it has one, such as `git -C <dir>` or `npm --prefix <dir>`.

**Keep profile policy intact when a command fails.** Report the command and working directory after removing credentials. Reproduce the specific quoting, encoding or path issue with `scripts/probe_argv.py` or `scripts/check_text.py`. Keep execution policy and the DSH sandbox active.

## Commit messages and other text passed to a CLI

**Write CLI text to a file and pass it by path.** Use `git commit -F <file>`, `gh ... --body-file <file>`, or `gh api ... -F body=@<file>`. The shell expands nothing in the file, and an analyser has nothing to infer.

**Use a quoted heredoc only in a compatible shell.** A quoted delimiter prevents expansion. An ordinary UTF-8 file passed to `git commit -F <file>` works across shells and avoids interpolation of backticks.

Never `-m` with backticks · never text that came through PowerShell 5.1's `Get-Content` (§ Encoding 1).

## Works here, breaks there

**When you shell out to someone else's CLI, its version on the target machine is the contract.** Local tests and review can pass against tools different from the target's.

1. **Probe the target before building on a third-party binary.** Probe the real machine, not the dev box; one command costs a minute.
   - **Prefer the oldest surface that answers the question.** For example: `gh api user --jq .login`, which every plausible version has.
   - **Branch on the exit code, never on stdout.** An error can itself be JSON; treating it as success can report a user called `{`.
   - **Encode the older contract in the test fake.** Reject `--json` the way the old `gh auth status` version does.
2. **A new value on an existing message is not additive.** A new message type is additive: an old receiver doesn't recognise it and drops it. A new value on an existing field reaches the old handler's default branch. Read what it does with an unrecognised value: reject it (safe), map to a default, or half-handle it. The last two need a capability flag, exactly as a new type does.
3. **The dev box's tools are part of what a review can see.** Tell the reviewer when the target differs, and explicitly reproduce the target's behaviour in the test. GNU coreutils 9.2 and later exit 1 when `mv -n` declines to overwrite; Git Bash's `mv` exits 0 (observed `2026-09-25`).

## Re-verify

**Retest each version-specific fact and replace any line whose behaviour changed.** Correct its date too. Delete a workaround whose cause is gone rather than keeping it beside the new fact.

| Fact | Observed | Re-test |
|---|---|---|
| auto-mode analyser stops `cd && cmd`, heredocs, variables | observed on 2.1.232/2.1.233, `2026-08-16`; not stopping on 2.1.310, observed `2026-10-24` | in auto mode on your version: `cd <dir> && sed -n '1,5p' <file>`, then a heredoc |
| Git Bash converts `/path` arguments | observed on Git 2.49.0, gh 2.100.0, `2026-10-24` | `python <skill dir>/scripts/probe_argv.py /x` |
| PowerShell splits bare `-c.a.b=c` | observed on PowerShell 7, `2026-08-24`; 5.1.26100, observed `2026-10-24` | `probe_argv.py -c.a.b=c` from each PowerShell |
| PS 5.1 `Get-Content` reads ANSI; `Set-Content -Encoding utf8` adds a BOM | observed on 5.1, `2026-07-31`; 5.1.26100, observed `2026-10-24` | round-trip a UTF-8 file, then `check_text.py` on it |
| PS 5.1 redirected native stderr is terminating under `Stop` | observed `2026-08-17`; 5.1.26100, observed `2026-10-24` | a native call that warns on stderr, with `2>&1` |
| PowerShell deletes an env var set to `""` | observed on 5.1.26100, `2026-10-25` | `$env:X = "x"; $env:X = ""; Test-Path Env:X` |
| Python pipes use the ANSI code page | observed on Python 3.13.1, `2026-10-24` | `python -c "import sys; print(sys.stdout.encoding)" \| cat` |
| PowerShell tool caps a call at 10 minutes | observed `2026-09-25` | the tools reference, or a long `Start-Sleep` |
| Bash tool falls back to PowerShell without Git Bash; PowerShell primary when enabled | 2.1.120, 2.1.126 (changelog, read `2026-10-24`) | the changelog |
| `mv -n` exit code: GNU 9.2+ exits 1, Git Bash exits 0 | observed `2026-09-25` | `mv -n a b` where `b` exists, `echo $?`, on each machine |

Each rule's origin, the case that taught it, is in `receipts.md` beside this file; read it when a rule's edge is unclear.

## How you can tell it worked

A probe shows the program received the arguments, paths and text you meant. The command means the same thing in the shell that actually runs it.

## Files

| File | Does |
|---|---|
| `scripts/check_text.py` | flags mojibake (UTF-8 decoded as CP1252 or CP1250), a UTF-8 BOM, CRLF and invalid UTF-8 in files, directories or a repository's changed and untracked files (`--changed`); `--fix-crlf` normalises line endings and nothing else; `--self-test` checks the checker |
| `scripts/probe_argv.py` | prints the arguments a program actually received, its working directory and its pipe encodings, for measuring what a shell did to a command |
