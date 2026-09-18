# Example: username change with reservation timing

This example follows a username change and its reservation window.

## Username rules (recap)

* Usernames are canonical-only ASCII letters, digits, underscore in `[a-z0-9_]`, 1-32 chars, no leading/trailing underscore (`spec/11-accounts.md` 11.4).
* A freed username stays reserved at the home instance for a reservation window (`spec/11-accounts.md` 11.8).

## 1. Initial state

`alice` at `b.social`, event history:

```text
e0: ACCOUNT_CREATED   (username "alice")
e1: DEVICE_AUTHORIZED (dv_alpha)
```

## 2. Change published

```text
USERNAME_CHANGED(4) from dv_alpha:
  0 previous_username : "alice"
  1 new_username      : "alice_keys"

predecessors: [e1]
```

`b.social` checks grammar and availability, then atomically reserves `alice_keys` and starts the reservation countdown for `alice` (90 days, `spec/82-limits-and-validation.md`).

## 3. Reservation semantics

For the next 90 days, `alice` resolves to this account if queried, showing the account as the former holder; new registrations of `alice` are rejected with `E_USERNAME_UNAVAILABLE`. After 90 days the instance releases the name, and the account no longer appears for the old handle.

## 4. Handle text

Alice's handle is now `alice_keys@b.social` (`spec/60-federation.md` 60.8). Identity is the account ID, not the handle: an account lookup by the account ID returns the current handle, and the ID never changes. The handle is a routing label only, never a key inside the signature domain (`spec/61-federation-authentication.md` 61.4 uses the account ID text, not the handle, in the signature input).