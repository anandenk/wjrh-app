# Shared agent instructions

These are the repository's durable working rules for Codex, Claude Code and other coding agents.
`CLAUDE.md` imports this file; keep one copy of the rules here. The owner's explicit task instructions take
precedence over repository defaults. Keep changing progress and verification in
[`docs/mobile-app/status.md`](docs/mobile-app/status.md), not in this file.

## Start each task

- Read the current state, verification limits and next steps in [`docs/mobile-app/status.md`](docs/mobile-app/status.md).
  Use [`CLAUDE.md`](CLAUDE.md) for the repository map/commands and [`docs/workflow.md`](docs/workflow.md) for the workflow.
  Read other docs only as needed for the task.
- Inspect `git status`, the current branch, recent `git log` and relevant PRs before editing. Code and current
  git/PR history establish implementation and merge state; old chat summaries and docs are context to verify.
- State the intended outcome and scope briefly. Respect audit-only, planning-only, file-type and testing limits.
  Proceed with reasonable, reversible choices; ask when missing information materially affects scope, behavior,
  cost or an irreversible action. Explain plainly and briefly: the owner is learning software development.
- Use one branch and one focused PR per task by default. Inspect existing work before creating another branch/PR.
  Use the `codex/` branch prefix for Codex-created branches. If another chat/tool is editing the same checkout,
  use a separate worktree; never switch its branch or overwrite its changes. Keep unrelated untracked files intact.

## Git and authorization

- Commit as `anandenk <321060286+anandenk@users.noreply.github.com>`.
- No `Co-authored-by`, generated-by, Codex or Claude attribution in commits or PRs.
- Push the task branch and open a PR when implementation is requested. For a read-only review or planning task,
  return findings without creating changes.
- Merge only when the owner explicitly requests it for that PR. A previous PR's merge authorization does not
  authorize future merges. Use squash merge by default, with the required author and no attribution.
  Never push directly to `main`. Rewriting published history requires explicit authorization.
- Deployment, app-store submission and public publication require explicit authorization for the destination.

## Project boundaries

- Don't play audio; the owner is often in class. Do not enable autoplay or start an audio-producing workflow by
  default. If audio-state testing is explicitly requested, keep output muted and follow the silent-testing procedure
  in the status doc. Audible playback requires the owner's explicit permission.
- Keep the live listener non-interactive: no upcoming songs, queue, song picking, per-track replay or live-stream
  recording controls. Upcoming shows are fine. Display title, artist and album when supplied; handle unknown data
  honestly: `null` means unknown, with an explicit empty state rather than "TBD". Every Play/resume reconnects at the live edge.
- Live audio goes directly from the stream URL, with the built-in fallback, never through the API. Mixcloud archive
  audio stays inside Mixcloud's own player. Live and archive playback are mutually exclusive.
- Never ship admin credentials or call `/v1/admin/*` from the listener app. Never commit secrets or expose unapproved
  student data publicly. While `/v1/station` has `approved: false`, the API sends `team: []` and the app hides the roster.
- Follow `frontend/index.html` as the visual reference; document intentional differences in
  [`docs/mobile-app/design-polish.md`](docs/mobile-app/design-polish.md). Keep demo content labelled and off in normal
  native builds. Demo album covers are not station artwork; remove/replace them before public release.
- Don't invent station biographies, history, recordings or backend capabilities. Leave missing content station-fillable.

## Verification and documentation belong to the change

- Run checks appropriate to the changed behavior and the owner's restrictions. App behavior changes normally need
  typecheck, unit tests, contract check and lint; backend/schema/tool code changes need backend tests and typecheck.
  Documentation-only changes need link/path, command-reference and diff review, not a build or app/server launch.
- Report what was actually checked, on which code/PR and environment/device, plus what was skipped and why.
  A successful compile or unit test is not runtime, simulator or physical-device verification. Dependency/native
  changes require a rebuild and fresh relevant runtime checks; preserve those as pending until performed.
- Before opening/updating a PR, search tracked docs for the changed feature, command, path, flag or claim. Update
  affected current guidance in the same PR, including status/next steps when progress or verification changes.
  If no docs need changes, give the reason in the PR; do not make a cosmetic status edit for every task.
- Give each kind of information one home (the ownership table is in [`docs/workflow.md`](docs/workflow.md)). Link to
  current status instead of copying dates, scores, version lists or pending work into multiple overviews.
  Preserve dated historical findings; label a superseding result separately with evidence.
- Before finishing, review the complete diff, check local links/paths and remove stale current-tense claims in the
  affected docs. Use the PR template to record behavior, verification, documentation impact and remaining work.
  Keep the PR title/body aligned with the final change; never mark a future check complete.
- Leave durable unfinished work in the existing status doc's next steps/verification sections or a linked issue,
  with enough context for the next session. End with the PR/branch, what changed, checks/skips and next action.
  Stop only processes started for this task and identify anything intentionally left running.
