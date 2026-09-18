# 64. Conflict resolution

This module defines deterministic presentation ordering and version conflict behavior.

## 64.1 No global ordering

The DAG is the authority on causality. Events do not have one universal global order. Two events MAY be concurrent: neither causally precedes the other.

```text
        A
       / \
      B   C
       \ /
        D
```

Here `B` and `C` are concurrent before `D`. Implementations MUST NOT silently declare `B` or `C` invalid merely because they are concurrent.

## 64.2 Deterministic presentation ordering

Where an application needs a deterministic display ordering, the client MAY use this rule:

1. Order by causal dependency: an event comes after its predecessors.
2. Among concurrent events, order by `created_at` ascending.
3. Break ties by `event_id` ascending (byte order).

This ordering is a presentation mechanism. It MUST NOT be treated as a replacement for the event DAG, and MUST NOT be used to invalidate events.

## 64.3 Trusted-device conflicts

If two different `TRUSTED_DEVICE_TRANSFERRED` events for the same account both causally precede an event and neither is an ancestor of the other, the account's trusted-device state is ambiguous. Validators MUST reject the event (error code `E_TRUST_CONFLICT`), per `42.3`.

## 64.4 Version conflicts (edits)

Concurrent edits produce concurrent versions. The application object types in `55.5` define their own conflict policy. For `post`, `reply`, and `direct_message`:

* The current version at a causal point is selected deterministically: newest `created_at`, then highest `event_id`.
* When two versions are concurrent and neither dominates, the client MUST present the conflict state and MAY offer a deterministic merge or let the user choose.
* Versions remain immutable; a later edit can reconcile to a merged version by setting its `previous_version_id` to one of the concurrent versions, per `34.10`.

## 64.5 Object state at a causal point

"Current version", "current profile", and "current relationship state" are always evaluated at a specific point in the DAG. Queries MUST be resolved relative to the validator's known causal frontier, never against a global total order. Forward-fill materialization is permitted when reconstructible from protocol data, per `100-conformance.md`.