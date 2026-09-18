# 62. Synchronization

This module is the authoritative definition of how instances synchronize events and objects, and how they resume after interruption.

## 62.1 Principles

Synchronization MUST support event discovery, event retrieval, object retrieval, missing-dependency recovery, duplicate detection, integrity verification, replay protection, and resumption after disconnection.

Synchronization MUST be idempotent. Receiving the same valid event multiple times MUST NOT create multiple logical events; the event ID performs deduplication.

If synchronization stops after event 100 of 200, the next synchronization MUST resume without corrupting or duplicating the first 100 events.

## 62.2 Sync session

The sync exchange is client-driven (a client here is the instance pulling data from a peer). The flow converges on a cursor:

1. The pulling instance calls `POST /v1/sync` with body `{0: cursor: bytes (optional), 1: interest: array<uint> (optional)}`.
2. The serving instance returns a sync page:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `cursor` | bytes | yes | Server-issued opaque cursor to resume from. |
| 1 | `events` | array&lt;event&gt; | yes | Up to `page_size` events added since the cursor that the peer is permitted to receive, oldest first. |
| 2 | `objects` | array&lt;object&gt; | yes | Objects referenced by the delivered events that the peer may receive and that fit the response budget. |
| 3 | `more` | bool | yes | Whether more pages follow; if `true`, repeat with the returned cursor. |

3. The pulling instance validates every event per `22.5` and every object per `33-object-envelope.md`, requests missing dependencies per `63-event-dependencies.md`, and applies what becomes authoritative.
4. After `more == false`, the pulling instance stores the final cursor as its sync state with the peer.

The cursor is opaque, server-issued, and MUST be treated as uninterpretable bytes. It encodes the server-side watermark for the peer and interest filter.

## 62.3 Interest filters

An instance SHOULD synchronize only events relevant to its members (`60.7`). The optional `interest` array MAY contain event type codes (`34.2`) or object type codes to narrow retrieval; an empty or absent `interest` means "everything this peer is permitted to receive". The server MUST NOT include events the peer is not permitted to receive, regardless of `interest`.

## 62.4 Cursor semantics and resumption

* A request without a cursor starts from the beginning of the peer's publishable stream.
* A request with a cursor resumes after the point the cursor represents.
* The cursor MUST be monotonic: pages returned for cursor `c` never include events already covered by `c`.
* Serving the same cursor twice MUST return the same set of events (denoting the boundary), so a lost response is recoverable by resending the request.
* The serving instance SHOULD keep enough history to serve a reasonable resume window (RECOMMENDED at least 7 days of cumulative published events per peer); older data MAY require the pulling instance to fetch events explicitly by ID, per `60.6`.

## 62.5 Page size and budgets

* `page_size` default is 512 events; a server MAY reduce it under load.
* The response `objects` array is bounded by a configured byte budget (default 8 MiB). Objects that exceed the budget are omitted from the page and MUST be fetched on demand via `GET /v1/objects/{object_id}`.
* A single object larger than the page budget is still publishable and fetchable individually.

## 62.6 Duplicate and integrity handling

* Events already held by the pulling instance (by `event_id`) MUST NOT be re-applied. They may be skipped.
* Every received event MUST pass structural and signature validation before application; an event that fails validation MUST be discarded with its error recorded, and MUST NOT be retried against alternate keys.
* Object integrity is verified by the AES-GCM associated data, per `23.4`. Ciphertext never decrypts to "an invalid object" at the sync layer; it is stored or refused on structural grounds only.

## 62.7 Failure handling

If a sync request fails transiently (network, TLS, transient `5xx` with `retryable` set), the pulling instance MUST retry with the last successfully applied cursor. If authentication fails, the pulling instance MUST re-fetch the peer's instance document per `61.2` before retrying.

## 62.8 Per-peer state

Each federation relationship SHOULD maintain synchronization state including `peer_instance_id`, `last_successful_sync`, `known_event_ids`, `known_object_ids`, `pending_dependencies`, `protocol_version`, and `capabilities`. The persistent representation is implementation-defined.