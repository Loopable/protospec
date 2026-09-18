# Loopable Protocol Specification

This directory is the normative specification of the Loopable Protocol, version 0.1.

The Loopable Protocol is a decentralized, privacy-first social networking protocol. It defines how independent implementations form one network: account identities, devices, encrypted objects, immutable events, social relationships, groups, files, federation, and the protocol behavior that ties them together.

An independent implementation must be able to read this directory, implement Loopable, connect to another implementation over the network, and interoperate without the implementer asking the protocol authors what was meant. This directory attempts to provide that.

## Document hierarchy

The specification is organized into numbered modules. Each module has one authoritative home for its subject matter. Other documents reference that definition rather than redefining it.

| Documents            | Subject |
| -------------------- | ------- |
| `00` to `02`         | Introduction, conventions, overview |
| `10` to `13`         | Identifiers, accounts, devices, instances |
| `20` to `25`         | Cryptographic primitives, key management, signatures, encryption, HPKE, MLS |
| `30` to `35`         | Serialization, wire types, event envelope, object envelope, event types, media streaming encryption |
| `40` to `42`         | Account, device, and authorization lifecycles |
| `50` to `56`         | Social relationships, profiles, contexts, messaging, content, media |
| `60` to `65`         | Federation, federation authentication, synchronization, dependencies, conflicts, object storage |
| `70` to `72`         | Instance discovery, search, notifications |
| `80` to `82`         | Errors, versioning and capabilities, limits and validation |
| `90` to `92`         | Security, privacy, threat model |
| `100` to `101`       | Conformance, implementation requirements |

Every module SHOULD be readable on its own, but an implementer building the full network SHOULD read the modules in numerical order at least once, then use cross-references to locate specific behavior.

## Precedence

The numbered modules are the authoritative normative definition of Loopable Protocol 0.1.

Conflicts between the modules and any other repository artifact are resolved in favor of the modules. The specification is the source of truth; `schemas/`, `test-vectors/`, and `examples/` support it and MUST agree with it.

## Completeness

The requirements are reorganized into the modules so that every requirement has one authoritative normative home:

* Canonical serialization rules: `30-serialization.md`, `31-wire-types.md`
* Identifier encodings and derivation: `10-identifiers.md`
* Event and object envelopes: `32-event-envelope.md`, `33-object-envelope.md`
* Event types and object types: `34-event-types.md`, `33-object-envelope.md`
* Account identity, username grammar, deletion: `11-accounts.md`, `40-account-lifecycle.md`
* Device authorization, revocation, transfer: `12-devices.md`, `41-device-lifecycle.md`
* Canonical signing and encryption domains: `22-signatures.md`, `23-encryption.md`, `24-hpke.md`
* Media streaming encryption and resumable upload: `35-media-encryption.md`, `56-media-and-files.md`
* Federation endpoints, authentication, replay window: `60-federation.md`, `61-federation-authentication.md`
* Synchronization and missing-event behavior: `62-synchronization.md`, `63-event-dependencies.md`
* Conflict resolution and versioning: `64-conflict-resolution.md`, `55-content.md`
* Object storage, retention, replication: `65-object-storage.md`
* MLS integration and group lifecycle: `25-mls.md`, `53-contexts-and-membership.md`
* Error registry, capability registry, version negotiation: `80-errors.md`, `81-versioning-and-capabilities.md`
* Limits and validation: `82-limits-and-validation.md`
* Security and privacy requirements: `90-security.md`, `91-privacy.md`, `92-threat-model.md`
* Conformance and test requirements: `100-conformance.md`, `101-implementation-requirements.md`

## Companion artifacts

* `schemas/` contains machine-readable CDDL definitions of the CBOR structures defined here.
* `test-vectors/` contains byte-exact vectors for first-device authorization, HPKE object-key wrapping, and versioned-object AAD, plus the remaining coverage plan.
* `examples/` contains complete, human-readable protocol exchanges.
* `decisions/` records the design decisions behind this specification.