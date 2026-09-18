# Example: a sync session

This example shows a cursor-based synchronization between `b.social` (service) and Alice's instance `a.social` (consumer), per `spec/62-synchronization.md`.

## 1. Initial sync

Alice just registered at `a.social`. Her client wants the full account history plus interest-filtered set of related events and objects.

```text
POST /v1/sync
Authorization: Loopable ...  (signed per examples/federation-request.md)
body (deterministic cbor):
  {
    1: [0, 12, 6, 13, 14, 17, 24]   ; interest: account-created, profile-updated,
  }                                  ; follow, post, edit, group, message
```

A request without key 0 starts from the beginning of the peer's publishable stream (`spec/62-synchronization.md` 62.4). The `interest` array is optional and holds event type codes (or object type codes); absent means everything the peer is permitted to receive.

## 2. First page

`b.social` returns the cursor-indexed window of authorized events from genesis, applying the interest filter (`spec/62-synchronization.md` 62.2):

```text
{
  0: cursor_b1,          ; opaque, e.g. "7"
  1: [ ACCOUNT_CREATED, DEVICE_AUTHORIZED, POST_CREATED, ... ],   ; events
  2: [ object(post1), object(profile) ],                          ; referenced objects
  3: true                ; more
}
```

Objects traveled opportunistically in the same page; anything missing that was referenced can be fetched later.

## 3. Follow-up pages

Client sends the next request with `cursor: cursor_b1`. The service continues until `more: false`.

## 4. Missing dependency recovery

The DAG append for Alice references the event with the newest predecessor known to `b.social`. If the client sees a predecessor it does not have (`spec/63-event-dependencies.md` 63.4), it issues a missing-event fetch:

```text
POST /v1/events:fetch
{ 0: [ missing_event_id ] }
```

The reply returns the canonical bytes or distinguishes `E_NOT_FOUND` from a genuine rejection. Duplicates are tolerated (`E_EVENT_ID_COLLISION` treated as success; idempotency per `spec/60-federation.md` 60.4).

## 5. Local processing

The client validates each event (structure, signatures, DAG insertion), marks it `VALIDATED`, decrypts what it can with local device keys, applies content, and only then treats the account state as current. Unavailable objects remain `DECRYPTABLE: false` without blocking the timeline (`spec/100.2`).