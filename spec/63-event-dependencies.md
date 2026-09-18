# 63. Event dependencies

This module is the authoritative definition of the event DAG and how missing dependencies are handled.

## 63.1 The event DAG

Loopable events form a directed acyclic graph. Each event MAY reference one or more predecessor events through the `predecessors` field (`32.2`).

Acyclic structure:

```text
        A
       / \
      B   C
       \ /
        D
```

Rules:

1. The graph MUST be acyclic. An implementation MUST reject an event whose dependency graph introduces a cycle, with error code `E_DAG_CYCLE` (`80-errors.md`).
2. The predecessor list MUST be canonical per `32.4`.
3. The predecessor list MUST NOT contain duplicates or the event's own id.
4. An event MUST NOT reference a predecessor event from a different account (see validation below).

Every dependency reference is to an event ID. The reference alone says nothing about contents; the referenced event remains independently validatable.

## 63.2 Validation

A receiving implementation MUST:

1. Verify that every predecessor event is known and has itself been validated, or place the incoming event in a pending state.
2. Verify that no predecessor belongs to a different account: every predecessor's `account_id` MUST equal the incoming event's `account_id`.
3. Verify that the introduction of the event adds no cycle.
4. Verify the event's own signature and authorization per `22-signatures.md` and `42-identity-and-authorization.md`.
5. Apply the event only after all required dependencies are available and validated.

`ACCOUNT_CREATED` events have no predecessors. Every other event MUST have at least one predecessor that is a causal root-reachable event; an event whose dependency path cannot be traced to its account's `ACCOUNT_CREATED` must be rejected as unrooted.

## 63.3 Missing events

If an instance receives an event whose predecessor is unavailable, it MUST NOT blindly apply the event. It MUST:

1. Record the missing dependency.
2. Request the missing event from the supplying peer (batch via `POST /v1/events:fetch`, or by id via `GET /v1/events/{id}`).
3. Retain the dependent event in a pending state.
4. Validate the dependency when received.
5. Apply the event only after all required dependencies are available and valid.

A missing-event request MUST identify the required event ID. Instances MAY batch missing-event requests. If a dependency cannot be retrieved, the dependent event MUST remain unresolved; the implementation MUST NOT treat the dependent event as authoritative state until required validation can be completed, and MUST NOT fabricate a substitute event.

## 63.4 Pending and unresolved states

Event states follow `100-conformance.md`:

* `PENDING`: received, awaiting dependencies.
* `VALIDATED`: dependencies and signature valid.
* `AUTHORIZED`: the signer's authorization is established.
* `APPLIED`: applied to derived state.

A pending event MUST NOT be applied, and its objects MUST NOT be presented to users as authoritative.

## 63.5 Duplicates and replay

The event ID is used for deduplication. Receiving the same event again MUST NOT cause a second state transition, per `62.6` and `39` of the foundational draft. An event whose ID collides with a previously accepted event but whose bytes differ MUST be rejected as a protocol integrity error (`E_EVENT_ID_COLLISION`), per `10.8`.

## 63.6 DAG and ordering

Events do not have one universal global ordering. Two independent events MAY be concurrent. An implementation MUST NOT invent a global total ordering and treat it as protocol truth. Ordering for display uses `64-conflict-resolution.md`.