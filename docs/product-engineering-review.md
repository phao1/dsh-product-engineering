# Independent Product Engineering review

Reviewed `dsh-product-engineering` 0.1.0 against DeepSeek Harness `0.2.1-rc.2`, commit `687f282e8625c6b8d11ff58211a90524be2e4317`. The review covered workspace authorization, concurrent edits, native session handoff, the owner RPC route, Markdown and JSON exports, and package contents.

| Finding | Correction and verification |
| --- | --- |
| Trimming the session path let a session in `project ` read records for sibling `project`. The same trimming could bind an owner-created project to the wrong directory. | The request, storage, and tool paths preserve filesystem spelling. A temporary SQLite exercise confirmed separate creation and listing for both directories. Native macOS path normalization also matched DSH for case aliases. |
| A session's unchanged `cwd` could move from workspace A to B when a symlink was retargeted. | Model tools require the original session path to be canonical on each call. The core check rejected both a symlink `cwd` and a registered directory replaced with a link to the other workspace. |
| A second Save after a revision conflict could apply an old form over newer fields. | The editor captures its opening project ID and revision, keeps the draft visible after a conflict, and disables Save until the editor is reopened. Verified in the client source. |
| DSH could reuse a blank session with an unsent draft, leaving the skill command out of the newly opened composer. | The handoff requests a fresh session, retains its binding, fills its draft, then opens it. An in-memory client test verified that sequence, preservation of an earlier draft, release on initialization refusal, and cancellation when navigation supersedes the launch. |
| Markdown fields could imitate a release heading or emit raw HTML. A bare carriage return could also escape the first version of artifact quoting. | Summary and decision context are escaped. Artifact content is labeled and quoted across LF, CRLF, and CR lines, with raw HTML escaped. A direct export test checked that the report has one top-level release heading and that JSON retains the original authored text. |

The owner route uses DSH's exact Fetch registration at `/api/product-engineering/workspace`. In the pinned DSH source, the Web carrier checks Host, Origin, and credentials before dispatch. Exact Fetch dispatch rejects non-owner peers before it invokes the plugin. Direct handler tests covered the nested Connection response, request ID echo, `no-store`, actor spoofing, malformed JSON, unsupported media type, and a streamed request larger than 256 KiB. The handler tests used a local engine stand-in. Installed carrier and browser evidence belongs to the [acceptance run](product-engineering-acceptance.md).

The npm package dry run contained all 44 skills, the Host and Client builds, and the license and source records. All 197 recorded SHA-256 hashes matched the pinned Product Engineering checkout. The 44 skill names and invocation flags matched their catalog entries.

This review used source inspection and focused local tests. Browser behavior and appearance require the separate acceptance run. Session tools require DSH's canonical directory spelling, so a session started through a filesystem alias must be reopened from its registered workspace. The Markdown renderer controls how authored links and images appear inside quoted artifacts. The JSON export retains the unmodified text.

## 0.2.0 independent review

Astra reviewed the integrated import, evidence projection and remediation changes.
The review identified loss of leading/trailing whitespace when reloading an import
path from activity records; the decoder now validates that value as an exact path,
and a second-connection regression preserves it. Focused import/remediation tests
passed 9/9. An independent Sol tester verified the final 738,087-byte package in
the real DSH headless runtime and reran all 27 tests under both Node versions.
No unresolved blocker was found in this scoped review. Browser interaction and
live-model quality remain outside the current run.
