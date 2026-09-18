# 100. Conformance

This module defines what it means to conform to the Loopable Protocol and the required test coverage.

## 100.1 Protocol invariants

Every compliant implementation MUST preserve these invariants:

1. An account identity key never changes.
2. An account has exactly one trusted device.
3. A device cannot become trusted without cryptographic authorization.
4. Instances cannot authorize devices.
5. Events are immutable.
6. Events form an acyclic dependency graph.
7. Event IDs are random and independent of event contents.
8. Objects are encrypted.
9. Ordinary object encryption uses AES-256-GCM.
10. MLS groups use the mandatory MLS 1.0 cipher suite.
11. Account signatures use Ed25519.
12. Device encryption keys use X25519.
13. General HPKE uses X25519 / HKDF-SHA-256 / AES-256-GCM.
14. An instance does not need plaintext decryption keys to operate.
15. There is no protocol-level global public user directory. Public profiles are individually lookupable but not enumerable (`51.5`, `13.7`).
16. Following does not grant decryption access by itself.
17. Identity location and object storage location are independent.
18. Discovery services are not protocol trust roots.
19. Editing or deleting an object creates a new event.
20. Missing dependencies are explicitly synchronized before events become authoritative.
21. Staff roles and moderation are instance-local (`13.10`); they never grant or deny plaintext decryption.

## 100.2 Protocol state

Implementations SHOULD distinguish these states and MUST NOT conflate them:

| State | Meaning |
| ----- | ------- |
| `KNOWN` | Structure received; not yet validated. |
| `VALIDATED` | Structure and signatures valid; dependencies present. |
| `AUTHORIZED` | The signer's authorization is established. |
| `DECRYPTABLE` | The object can be decrypted by this installation. |
| `APPLIED` | Applied to derived state. |
| `REVOKED` | Later revocation makes the event inapplicable to new state. |
| `DELETED` | A deletion event applies. |
| `UNAVAILABLE` | Not retrievable or not decryptable. |

An event may be `VALIDATED` and NOT `DECRYPTABLE`; an object may be `DECRYPTABLE` only when the client has the right key. An instance never requires `DECRYPTABLE` for its own operation. Event history is authoritative protocol evidence; application state is derived and MUST be reconstructible from protocol data (`100.4`).

## 100.3 Conformance requirements

A conforming implementation MUST satisfy:

1. Serialization: produce and parse deterministic CBOR per `30-serialization.md`; reject non-canonical input per `31.9`.
2. Cryptography: implement the mandatory suite of `20.2` using the constructions of `22-signatures.md`, `23-encryption.md`, and `24-hpke.md`.
3. Identity: derive and validate identifiers per `10-identifiers.md`; validate device chains per `42-identity-and-authorization.md`.
4. Device and account lifecycle: `40-account-lifecycle.md`, `41-device-lifecycle.md`.
5. Events: `32-event-envelope.md`, `34-event-types.md`, DAG rules of `63-event-dependencies.md`.
6. Objects: `33-object-envelope.md` and the type content schemas of the social modules.
7. Federation: endpoints of `60-federation.md` and authentication of `61-federation-authentication.md`.
8. Synchronization: `62-synchronization.md`.
9. Groups: `25-mls.md`, `53-contexts-and-membership.md`.
10. Deletion and storage: `65-object-storage.md`.
11. Limits and errors: `82-limits-and-validation.md`, `80-errors.md`.

Coverage of the above in automated tests is described in `101-implementation-requirements.md`. Byte-exact vectors for first-device authorization, HPKE object-key wrapping, and versioned-object AAD, and the coverage plan for the rest, live in `test-vectors/`.