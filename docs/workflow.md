# Implementation Workflow

This workflow is intentionally simple and strict.

## 1) Start

- Read `docs/STATE.md` first.
- Read relevant runbook(s) and ADR(s) before changing code.
- Confirm task scope and expected output.

## 2) Implement

- Make smallest safe change first.
- Verify locally (`typecheck`, targeted build/test).
- Keep changes scoped; avoid unrelated refactors.

## 3) Documentation Update Gate (Required)

Before considering work done, answer:

- Did product behavior or technical state change?
  Update `docs/STATE.md`.
- Did we make or revise an architecture decision?
  Add/update ADR in `docs/adr/`.
- Did command/process/operations change?
  Update relevant runbook in `docs/runbooks/`.

If none apply, write:

`Notes update: not required (no state/decision/runbook impact).`

## 4) Ship

- Deploy using runbook procedure.
- Confirm live artifact updated.
- Record any post-deploy caveat in `docs/STATE.md` if meaningful.

## 5) For Agent Sessions

- Always treat `docs/` as canonical memory.
- Prefer adding one concise note over long chat-only context.
- If interrupted mid-task, first action is a state check:
  inspect current git diff, then continue with docs in sync.
