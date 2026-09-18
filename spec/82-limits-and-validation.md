# 82. Limits and validation

This module is the authoritative registry of protocol limits, validation requirements, and rate-limiting groups.

## 82.1 Limits

| Item | Limit | Where |
| ---- | ----- | ----- |
| Username length | 4 to 14 chars | `11-accounts.md` |
| Display name length | 1 to 64 chars | `51-profiles.md` |
| Biography length | 0 to 2048 chars | `51-profiles.md` |
| Post/message text | 0 to 65536 chars | `55-content.md`, `54-messaging.md` |
| Event canonical size | max 65536 bytes | `32-event-envelope.md` |
| Social object canonical size (non-media) | max 262144 bytes | `33-object-envelope.md` |
| Media plaintext | max 2147483648 bytes (2 GiB) per object | `56-media-and-files.md` |
| Streaming AEAD segment size | 1 MiB (1048576 bytes) | `35.5` |
| Streaming AEAD header | 40 bytes | `35.3` |
| Recipient records per object | max 256 | `24-hpke.md` |
| Predecessors per event | max 64 | `32-event-envelope.md` |
| Object references per event | max 64 | `32-event-envelope.md` |
| Account lookup device summary | max 16 entries | `60.8` |
| Sync page size | default 512 events | `62.5` |
| Sync object budget | default 8 MiB per page | `62.5` |
| Request body size | max 8 MiB; media upload blobs exempt, bounded by the media limit | `60-federation.md`, `35.10` |
| Federation replay window | 300 s | `61.5` |
| Username reservation | 90 days | `40.3` |
| Operational key lifetime | SHALL be bounded; no protocol max | `13.3` |
| MLS key package validity | max 7 days | `25-mls.md` |
| Pending device join request lifetime | max 30 days | `60.10` |
| Moderation suspension interval | max 365 days | `13.10.3` |
| Instance document `description` | max 4096 chars | `13.3.1` |
| Instance rules | max 32 rules, 512 chars each | `13.3.1` |

An implementation MUST reject data that exceeds a limit with the appropriate error from `80-errors.md` (`E_BAD_REQUEST` for size and length violations). Limits protect both peers; a server SHOULD apply them before expensive cryptographic work.

## 82.2 Validation rules

Every input MUST be validated as follows before it affects any state:

1. Structural validation per `31.9` (types, lengths, canonical encoding).
2. Version validation per `81.2`.
3. Identifier validation per `10-identifiers.md`.
4. Envelope validation per `32-event-envelope.md` or `33-object-envelope.md`.
5. Signature validation per `22-signatures.md`.
6. Authorization validation per `42-identity-and-authorization.md`.
7. Dependency validation per `63-event-dependencies.md`.
8. Type-specific validation per `34-event-types.md` and the type's module.

## 82.3 Negative behaviors

An implementation MUST reject (and MUST be tested to reject): invalid Ed25519 signatures; unauthorized devices; revoked devices producing new events; malformed event IDs; duplicate event IDs with different contents; DAG cycles; missing dependencies treated as valid; invalid AES-GCM authentication; invalid streaming AEAD authentication (bad tag, wrong final-segment mark, or bad nonce construction); invalid HPKE ciphertext; unauthorized recipient key use; malformed canonical encodings; unsupported mandatory versions; forged instance signatures; forged account signatures; and invalid username ownership transitions.

Malformed events are rejected when: the signature is invalid, the account ID or device authorization is invalid, the canonical encoding is malformed, a predecessor is a duplicate or self-reference, the DAG would cycle, the timestamp representation is invalid, an unknown mandatory field is required by a mandatory event type that cannot be applied, an object reference is invalid, or cryptographic parameters are invalid.

## 82.4 Rate-limiting groups

Instances MAY rate limit, and SHOULD rate limit at least:

| Group | Requests covered |
| ----- | ---------------- |
| `lookup` | account, profile, and membership lookups |
| `events` | event submission and retrieval |
| `objects` | object submission and retrieval |
| `fetch` | missing-event batch fetches |
| `media` | media upload and download |
| `membership` | group membership and join requests |
| `device-join` | device join request submission (`60.10`) |
| `search` | all search over the base or private endpoints |

Rate limiting MUST NOT modify cryptographic semantics. It only limits throughput. Rate-limit responses are `E_RATE_LIMITED` with a `Retry-After`-equivalent hint in `details` where the server provides one.

## 82.5 Unknown types

* Unknown optional event types MAY be retained as opaque events.
* Unknown mandatory event types MUST NOT be applied.
* Unknown optional object types MAY be retained as opaque objects.
* Unknown mandatory object types MUST NOT be applied.

In all cases implementations MUST preserve enough information to avoid corrupting the event DAG, per `63-event-dependencies.md`, and MUST record the state as `KNOWN` (not `APPLIED`), per `100-conformance.md`.