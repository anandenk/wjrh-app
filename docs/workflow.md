# Shared development workflow

This workflow applies to Claude Code, Codex and the owner. Its purpose is to leave each task understandable and
reviewable without a separate documentation catch-up session. Durable agent rules live in [`../AGENTS.md`](../AGENTS.md).

## Give each fact one home

| Information | Authoritative home | Update when |
|---|---|---|
| Shared behavior, authorization, author identity and project boundaries | [`../AGENTS.md`](../AGENTS.md) | The owner changes a working agreement |
| Claude Code import, repository map and quick command index | [`../CLAUDE.md`](../CLAUDE.md) | A mapped location or common command changes |
| Human overview and links | [`../README.md`](../README.md) | The project's purpose or navigation changes; link to status for progress |
| Current implementation, verification limits, station decisions and ordered next steps | [`mobile-app/status.md`](mobile-app/status.md) | A task changes behavior, evidence, a decision or unfinished work |
| Architecture and intended scope | [`mobile-app/plan.md`](mobile-app/plan.md), [`backend-proposal/decisions/`](backend-proposal/decisions/) | An architecture decision or approved scope changes |
| App setup, layout, scripts and env vars | [`../apps/mobile/README.md`](../apps/mobile/README.md) | App developer instructions change |
| Backend setup and check procedures | [`../backend/README.md`](../backend/README.md), [`../backend/TESTING.md`](../backend/TESTING.md) | Backend developer instructions change |
| API shapes | `backend/schemas/` at repo root; [`backend-proposal/api.md`](backend-proposal/api.md) explains them | A schema/endpoint changes; regenerate mobile types and update affected fixtures |
| Phone acceptance results | [`mobile-app/iphone-test-checklist.md`](mobile-app/iphone-test-checklist.md) | A named check actually runs on a physical device |
| Visual and demo contracts | [`mobile-app/design-polish.md`](mobile-app/design-polish.md), [`mobile-app/archive-demo.md`](mobile-app/archive-demo.md) | Screen behavior, deliberate differences or demo assumptions change |
| Dated experiments and observations | The original dated findings, such as [`mobile-app/audio-spike.md`](mobile-app/audio-spike.md) | Preserve the record; put new results in current status with a date/evidence |
| What a particular change did and how it was verified | Its PR description | Before review, after scope changes, and when checks or blockers change |

Code and current git/PR history establish what exists and what merged. Documents explain intent and evidence;
they do not prove that a build was launched, a phone was tested or a deployment happened. Verify external facts
when relevant, or keep them dated/unverified. Prefer PR references to short commit IDs; verify any ID against the
current history, especially after a rewrite. A status baseline identifies the last reviewed code, not necessarily
the latest documentation-only commit.

Use precise status words: **implemented** means code exists; **verified** names the actual checks and environment;
**merged** means git/PR history confirms it; **deployed** names a running destination/version. These are different
facts. A merged implementation can still have pending phone checks and no production deployment.

## One task from start to finish

1. **Orient.** Read `AGENTS.md` and the status doc, inspect the checkout and relevant open PRs, then state the task's
   outcome, scope and restrictions. Use the existing next-steps list as the queue; do not invent another backlog file.
2. **Isolate.** Use one branch and one focused PR by default. Start independent work from current `main`; continue an
   existing branch when that is the task. Use a separate worktree when another session is editing. If work genuinely
   depends on an unmerged PR, state its base and merge order explicitly; otherwise avoid stacked PRs.
3. **Implement.** Keep the diff within the agreed scope. Record a decision where it belongs if it changes an accepted
   contract. Mention a discovered unrelated issue as a follow-up rather than silently expanding the task.
4. **Verify.** Run the relevant allowed checks and inspect the result. Record skips or failures honestly. After a
   native/dependency change, earlier runtime evidence remains historical; rebuilding and re-running affected behavior
   stays pending until performed. Do not replace phone checks with simulator results.
5. **Update docs in the same PR.** Search tracked Markdown for the feature/command/flag/path affected. Update its owning
   guide and status if needed, then repair contradictory current references. Check links and backticked paths against
   the checkout; qualify generated, historical, example and proposed paths. No documentation impact is acceptable
   when the PR explains why. A wording-only fix does not need a new handoff entry or runtime tests.
6. **Review and hand off.** Inspect the full diff for code, docs, generated files, secrets and unrelated changes. Fill
   the short PR template with the final behavior, checks/skips, docs impact and unresolved work. Commit with the
   required identity, push the task branch and open/update the PR. Finish with the link and the next concrete action.
7. **Merge when requested.** Check the PR's current head, conflicts and checks; merge only with authorization for that
   PR. After merging, verify the result and update the local checkout safely. Do not delete another session's branch
   or worktree. Update the existing PR description if its follow-up status changes; do not create a new status file
   just to record that a PR merged.

## Keep handoffs useful

For meaningful unfinished work, put these details in the existing status doc or a linked issue:

- What remains and why it matters.
- The relevant PR/code baseline and environment/device, if verification is involved.
- What passed, what was skipped, and why an old result no longer covers the current version.
- The next action and who can do it: agent, owner with a phone, or station decision-maker.

The status doc's **Next steps, in order** is the implementation queue; **Waiting on people** holds decisions.
Keep that distinction, and remove or update a follow-up in the same PR that completes it. Do not call a pending
item done because its code compiled, its PR opened or another prerequisite merged.

Keep experimental screenshots/logs in temporary or explicitly selected artifact locations. Track durable source,
guides and instructions in git. Inspect `git status` before finishing: every remaining change should have a known
owner or explanation. Stop task-owned background processes unless the owner needs the preview left running.

## Using both tools

Both tools follow `AGENTS.md`; `CLAUDE.md` imports it with `@AGENTS.md`. The import is intentional because the
repository has both entry files. Keep all durable work in the repository and PR, so moving between tools does not
depend on private chat history or either tool's memory.
Loading references: [OpenAI's AGENTS.md guide](https://learn.chatgpt.com/docs/agent-configuration/agents-md) and
[Claude Code's imports guide](https://code.claude.com/docs/en/memory#import-additional-files).

Use one tool as the writer for a task. The other can review the PR. Parallel implementation needs separate
worktrees, clearly separate scope and an agreed integration order; do not have both tools editing one checkout.
An open PR remains unfinished work even when one chat ends. The next chat should inspect it before starting a duplicate.

A reusable starting prompt for either tool:

> Read AGENTS.md and the current status. Work on [one task]. Respect [restrictions]. Update affected docs in the same
> PR, report checks and skips, and leave a concrete handoff. Do not merge until I explicitly request it.

## Review gate

The PR template makes documentation impact and verification visible during review; it does not run checks or
guarantee factual freshness. There is no new CI job or hook in this workflow. Each agent must perform the relevant
review before calling its work ready. If repeated mechanical mistakes remain, add a focused automated link/path
check in a separate task; such a check cannot prove a runtime or station-owned claim.
