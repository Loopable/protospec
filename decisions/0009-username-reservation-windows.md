# 0009: Username and deletion reservation windows

* Status: accepted
* Basis: `spec/11-accounts.md` 11.8, `spec/40-account-lifecycle.md`, `spec/65-object-storage.md`; earlier text described conflicting reservation durations (14 days of closure grace and a distinct deletion timeline).

## Context

Earlier text was ambiguous about what a name means while an account is being deleted: it mentioned a short closure-window and a separate deletion process, without saying which governs a username held by the account being deleted.

## Alternatives

1. Free the username immediately at deletion start. Rejected: it allows squatting a deleted account's name before any observer has learned of the deletion, creating a takeover window.
2. Free it only after account deletion fully completes (the deletion timeline). Chosen.
3. Two names for the same account. Rejected.

## Decision

A username freed by any transition stays reserved to the account for a reservation window of 90 days (the deletion timeline), during which new registrations receive `E_USERNAME_UNAVAILABLE` and resolution of the old handle points to the former holder. After the window the name is released.

## Consequences

The 90-day duration is confirmed. `spec/40-account-lifecycle.md` 40.3 and `spec/82-limits-and-validation.md` record it consistently, as does the `USERNAME_CHANGED` note in `spec/34-event-types.md` 34.7.

* Username squatting between deletion start and release is prevented.
* A deleted account's historical events remain, so the handle always resolves to the deleted account until the window ends.