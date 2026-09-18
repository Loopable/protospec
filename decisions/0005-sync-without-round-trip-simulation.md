# 0005: Synchronization without "round-trip simulation"

* Status: accepted
* Basis: `spec/62-synchronization.md`, `spec/63-event-dependencies.md` (resolves the earlier "round-trip simulation" idea of re-sending events when the peer already has them).

## Context

An earlier proposal re-fetched objects an implementation already holds, as a heuristic for repairing invalid local state. That turns a protocol exchange into a state-repair mechanism with no defined failure signal.

## Alternatives

1. Keep the heuristic. Rejected: it optimizes for the wrong case (transactional clients) and cannot distinguish "absent" from "present but broken".
2. Push the responsibility to the consumer: consumers validate continuously; a consumer that sees a bad object reports exactly why it is bad and re-fetches on its own decision. Chosen.

## Decision

Synchronization is cursor-based (`spec/62-synchronization.md` 62.2). Missing objects are fetched explicitly and idempotently via `/v1/events:fetch` and the object DAG dependency rules (`spec/63-event-dependencies.md`). There is no "simulate a round trip" protocol action.

## Consequences

* The protocol does not waste bandwidth re-delivering intact data.
* Implementations are responsible for their own repair pathway; this is documented in `spec/101-implementation-requirements.md` 101.2.
* `E_MISSING_DEPENDENCY` is actionable and retryable.