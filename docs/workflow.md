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
- If the task changes database shape, stored data semantics, or write/read
  behavior, update the corresponding Redis/cache layer and affected API read
  contracts in the same task. DB work is not considered complete if cache keys,
  cache invalidation, or API payloads are left stale.
- Update code comments when behavior, assumptions, or edge-case handling
  changes. Add brief comments only where they improve understanding for humans
  and future agents; remove or rewrite stale comments immediately.

## 3) Documentation Update Gate (Required)

Before considering work done, answer:

- Did product behavior or technical state change?
  Update `docs/STATE.md`.
- Did we make or revise an architecture decision?
  Add/update ADR in `docs/adr/`.
- Did command/process/operations change?
  Update relevant runbook in `docs/runbooks/`.
- Did database behavior change?
  Update `docs/STATE.md` and any runbook/ADR note that describes the matching
  cache and API contract expectations.
- Did the change introduce or alter non-obvious logic?
  Update nearby code comments and any note that future humans/agents would need
  in order to extend the behavior safely.

If none apply, write:

`Notes update: not required (no state/decision/runbook impact).`

## 4) Ship

- Deploy using runbook procedure.
- Confirm live artifact updated.
- Record any post-deploy caveat in `docs/STATE.md` if meaningful.

## 5) For Agent Sessions

- Always treat `docs/` as canonical memory.
- Prefer adding one concise note over long chat-only context.
- Prefer concise, high-signal comments over silent cleverness. Comment the why,
  invariants, coupling points, and future update traps; avoid narrating obvious
  code.
- If interrupted mid-task, first action is a state check:
  inspect current git diff, then continue with docs in sync.
