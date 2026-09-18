# 0009: Username and deletion reservation windows

* Status: blocking
* Basis: `spec/11-accounts.md` 11.8, `spec/40-account-lifecycle.md`, `spec/65-object-storage.md`; draft sections 33 and 40 describe conflicting reservation durations (14 days of closure grace and a distinct deletion timeline).

## Context

The draft is ambiguous about what a name means while an account is being deleted: it mentions a short closure-window and a separate deletion process, without saying which governs a username held by the account being deleted.

## Alternatives

1. Free the username immediately at deletion start. Rejected: it allows squatting a deleted account's name before any observer has learned of the deletion, creating a takeover window.
2. Free it only after account deletion fully completes (the deletion timeline). Chosen.
3. Two names for the same account. Rejected.

## Decision

A username freed by any transition stays reserved to the account for a reservation window of 90 days (the deletion timeline), during which new registrations receive `E_USERNAME_UNAVAILABLE` and resolution of the old handle points to the former holder. After the window the name is released.

## Consequences (MUST be reviewed before 1.0)

* The 90-day number is deliberately longer than the draft's 14-day closure window. The working group must confirm the concrete duration, because 90 days is the compromise the spec currently records.
* Handle squatting between deletion start and release is prevented.
* A deleted account's historical events remain, so the handle always resolves to the deleted account until the window ends.