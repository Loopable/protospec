# 32. Event envelope

This module is the authoritative definition of the event envelope: the signed structure carried by the protocol.

## 32.1 Purpose

An event is an immutable, authenticated state transition. Events reference objects and previous events. Every change in Loopable account, device, social, or group state is represented by an event.

## 32.2 Event map

The event is a CBOR map with the following keys:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `protocol_version` | text | yes | Protocol version `"0.1"`, per `81-versioning-and-capabilities.md`. |
| 1 | `event_id` | bytes(16) | yes | Random event identifier, per `10.4`. |
| 2 | `event_type` | uint | yes | Event type code from `34-event-types.md`. |
| 3 | `account_id` | bytes(32) | yes | The account the event belongs to. |
| 4 | `device_id` | bytes(16) | yes | The device that originated and signed the event. |
| 5 | `created_at` | time | yes | Informational creation timestamp. |
| 6 | `predecessors` | array&lt;bytes(16)&gt; | yes | Event IDs this event depends on; may be empty. |
| 7 | `object_references` | array&lt;object_reference&gt; | yes | Objects involved; may be empty. |
| 8 | `body` | map | yes | Type-specific payload, per `34-event-types.md`. |
| 9 | `signature` | bytes(64) | yes | Ed25519 signature, per `22-signatures.md`. |

The signature field `9` is never included in the signature input. See `22.3`.

### object_reference

An object reference is a map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `object_id` | bytes(32) | yes | The referenced object. |
| 1 | `version_id` | bytes(32) | no | The specific encrypted version, when a version is referenced. |

## 32.3 Field semantics

* `protocol_version` MUST be `"0.1"` for a version 0.1 event. Receivers MUST reject events whose version they cannot process, per `81-versioning-and-capabilities.md`.
* `event_id` is random and independent of event contents, per `10.4`. Event IDs are not content hashes. The event ID is used for deduplication and DAG references.
* `event_type` selects the body schema and the authorization requirement, per `34-event-types.md`.
* `account_id` and `device_id` identify the signer for authorization resolution, per `42-identity-and-authorization.md`.
* `created_at` is informational. It MUST NOT be used as the sole mechanism for ordering events, and clock skew MUST NOT invalidate an otherwise valid event solely because clocks differ.
* `predecessors` defines the DAG edges: each entry is an event this event directly depends on. Predecessors MUST be canonicalized to the order defined here (see 32.4), MUST NOT contain duplicates or self-references, and MUST NOT introduce a cycle, per `63-event-dependencies.md`.
* `object_references` lists objects involved in the event without leaking their contents.
* `body` is defined per event type and MUST be a map. Sensitive application content goes into encrypted objects, not the event body, per `32.6`.

## 32.4 Predecessor ordering

The `predecessors` array MUST be sorted in canonical event-ID byte order (lexicographic byte order of the 16-byte identifiers), ascending, with no duplicates. Sorting makes the DAG edge set canonical and is part of the signature input.

## 32.5 Immutability

Events are immutable. Once an event has been accepted as valid, its contents MUST NOT be modified. An edit, a deletion, a relationship change, or a profile change MUST create a new event. An event MUST NOT be silently rewritten.

## 32.6 Event body and encrypted content

Events and encrypted objects are distinct. An event MAY carry encrypted object references and unencrypted protocol metadata. Sensitive application content SHOULD remain inside encrypted objects. An event MUST NOT contain plaintext social content unless `34-event-types.md` explicitly defines the field as non-sensitive.

## 32.7 Validity

An event is valid only when it passes every step of `22.5` and `42-identity-and-authorization.md`. Invalid events MUST be rejected with the error codes of `80-errors.md`.

## 32.8 Transport

Events are transported by the endpoints defined in `60-federation.md`. The same bytes are exchanged without modification; a relay MUST NOT modify any field of an event.