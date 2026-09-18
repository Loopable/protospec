# 02. Protocol overview

This module explains how the protocol is put together. It is explanatory; normative definitions live in the modules it references.

## 2.1 Core concepts

The protocol has five foundational concepts:

1. **Account**: a permanent cryptographic identity, defined in `11-accounts.md`.
2. **Device**: an installation holding key material authorized by the account, defined in `12-devices.md`.
3. **Instance**: a network service implementing the server side of the protocol with its own cryptographic identity, defined in `13-instances.md`.
4. **Event**: an immutable, signed state transition, defined in `32-event-envelope.md`. Events form a directed acyclic graph (DAG), defined in `63-event-dependencies.md`.
5. **Object**: encrypted application data referenced by events, defined in `33-object-envelope.md`.

Instances store and relay events and encrypted objects. They never require the plaintext of a social object to operate.

## 2.2 Trust model

The trust hierarchy is:

```text
Account identity key (Ed25519)
        |
        | authorizes
        v
Device (Ed25519 signing, X25519 encryption)
        |
        | signs
        v
Event
        |
        v
Encrypted object (AES-256-GCM, keys wrapped via HPKE or MLS)
```

An instance sits beside this hierarchy, not above it. An instance stores ciphertext, transports events, verifies signatures, enforces its own local policy, and synchronizes data. An instance MUST NOT control an account identity, authorize devices, or need plaintext decryption keys to operate. The threat model in `92-threat-model.md` specifies what an instance can and cannot do, and what a compromise of each component implies.

## 2.3 A post in flight

The following sequence shows the protocol path for a normal post. It matches the normative requirements across this specification:

1. A client signs in to its account on its trusted device.
2. The client creates the post plaintext and a random 256-bit content-encryption key (CEK), per `23-encryption.md`.
3. The client generates a random 96-bit nonce and encrypts the plaintext with AES-256-GCM, authenticating canonical envelope metadata, per `23-encryption.md`.
4. The client wraps the CEK for every authorized recipient using HPKE (or an MLS group), per `24-hpke.md`.
5. The client builds the encrypted object envelope, per `33-object-envelope.md`.
6. The client builds a `POST_CREATED` event referencing the object, per `34-event-types.md`.
7. The device signs the event with its Ed25519 key over the canonical signature input, per `22-signatures.md`.
8. The client submits the event and object to an instance over an authenticated connection, per `60-federation.md`.
9. The instance validates the device authorization, the signature, the DAG dependencies, and the envelope, then stores the ciphertext, per `42-identity-and-authorization.md` and `65-object-storage.md`.
10. The instance federates the event and object to peer instances that are permitted to receive them, per `60-federation.md` and `62-synchronization.md`.
11. An authorized recipient's client recovers the encrypted event and object, validates them, recovers the CEK with its X25519 private key, and authenticates and decrypts the plaintext, per `23-encryption.md` and `24-hpke.md`. 

At no step does any instance require the plaintext.

## 2.4 Federation model

Federation is an authenticated event and object exchange protocol, not a command replication system. Instances do not call each other with operations such as "create post" or "follow user". Instead they exchange:

* authenticated events, which represent state transitions;
* encrypted objects, which carry application data;
* synchronization metadata, which drives discovery of missing data.

Instances exchange only data relevant to them. There is no global replication of the network. The exchange rules are defined in `60-federation.md` and `62-synchronization.md`.

## 2.5 Contexts and audiences

A context is a scope in which accounts interact and encrypted data is made available. An instance membership and a social relationship membership are distinct concepts. An account may be a member of an instance without being a member of a private group, and following someone does not grant access to their private content. Contexts are defined in `53-contexts-and-membership.md`. Audiences and recipient key records are defined in `33-object-envelope.md`.

## 2.6 Invariants

The protocol maintains the following invariants across every implementation. They are normative requirements assembled in `100-conformance.md`:

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

## 2.7 Module map

| Concern | Module |
| ------- | ------ |
| Identity and naming | `10-identifiers.md`, `11-accounts.md`, `12-devices.md`, `13-instances.md` |
| Cryptography | `20-cryptographic-primitives.md` to `25-mls.md` |
| Encoding | `30-serialization.md`, `31-wire-types.md` |
| Events and objects | `32-event-envelope.md`, `33-object-envelope.md`, `34-event-types.md` |
| Lifecycles | `40-account-lifecycle.md`, `41-device-lifecycle.md`, `42-identity-and-authorization.md` |
| Social | `50-social-relationships.md` to `56-media-and-files.md` |
| Federation | `60-federation.md` to `65-object-storage.md` |
| Services | `70-instance-discovery.md`, `71-search.md`, `72-notifications.md` |
| Registries | `80-errors.md`, `81-versioning-and-capabilities.md`, `82-limits-and-validation.md` |
| Security | `90-security.md`, `91-privacy.md`, `92-threat-model.md` |
| Conformance | `100-conformance.md`, `101-implementation-requirements.md` |