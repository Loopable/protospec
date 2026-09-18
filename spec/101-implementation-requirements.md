# 101. Implementation requirements

This module defines the required implementation structure, the extension process, and the completeness checklist for version 1.0.

## 101.1 Required implementation layers

An implementation SHOULD be separated into:

```text
Protocol Core
    |
    +-- Serialization          (30-serialization.md, 31-wire-types.md)
    +-- Cryptography           (20-25)
    +-- Identity               (10-13)
    +-- Device Authorization   (42)
    +-- Event DAG              (63)
    +-- Object Encryption      (23, 24)
    +-- MLS                   (25)
    +-- Federation            (60-62)
    +-- Storage               (65)
    +-- Application Model     (social modules)
    +-- Client UI             (not protocol)
```

The protocol core MUST NOT depend on a specific UI.

## 101.2 Protocol core capabilities

The protocol core MUST be able to: parse protocol objects; produce canonical serialization; verify signatures; validate identity chains; validate event DAGs; encrypt objects; decrypt authorized objects; process key envelopes; process device authorization and revocation; and validate federation messages.

## 101.3 Implementation independence

The official implementation MUST NOT be treated as a specification oracle. If an implementation contains behavior not described by this specification, that behavior is not automatically part of Loopable. If interoperability depends on an implementation-specific behavior, the behavior MUST be added to this specification before it becomes normative.

## 101.4 Extension process

A protocol extension MUST specify:

1. the problem being solved;
2. the security impact;
3. the privacy impact;
4. the wire representation (with CDDL, per `schemas/README.md`);
5. the authorization model;
6. the cryptographic requirements;
7. the compatibility behavior (`81-versioning-and-capabilities.md`);
8. the failure behavior;
9. the synchronization behavior;
10. test vectors or their coverage plan.

No extension SHOULD be merged merely because an implementation already exists.

Extensions MUST follow `81.5`: they MUST NOT change the meaning of existing fields and MUST NOT reuse registered identifiers. A new cryptographic construction MUST register a new domain-separation label in `20.12`. A new capability MUST be registered in `81.3`; a new error code in `80.2`; a new event type in `34.2`; a new object type in `33.7`.

## 101.5 Version 1.0 completeness checklist

The foundational draft's section 178 requirements are satisfied by the following modules. Before Loopable Protocol 1.0 is declared stable, each MUST remain fully specified here (and in `schemas/`, `examples/`, and `test-vectors/` as noted), rather than being left implementation-defined:

| Requirement | Home |
| ----------- | ---- |
| Complete canonical CBOR schemas | `30-serialization.md`, `31-wire-types.md`, `schemas/` |
| Every event type and field | `34-event-types.md`, `32-event-envelope.md` |
| Every object type and field | `33-object-envelope.md` and the social modules |
| Account and instance ID encoding | `10-identifiers.md` |
| Username grammar | `11-accounts.md` |
| Hostname canonicalization | `13-instances.md` |
| Federation HTTP endpoints | `60-federation.md` |
| HTTP authentication format and request signature | `61-federation-authentication.md` |
| Replay window | `61.7`, `82.1` |
| Event serialization and signature input | `30-serialization.md`, `22-signatures.md` |
| Object envelope, AES-GCM AAD, HPKE envelope, recipient records | `33-object-envelope.md`, `23-encryption.md`, `24-hpke.md` |
| Device authorization, revocation, transfer schemas | `12-devices.md`, `34.4`, `34.5`, `34.6` |
| Account and object deletion semantics | `40-account-lifecycle.md`, `65-object-storage.md` |
| Object versioning and concurrent-edit semantics | `55-content.md`, `64-conflict-resolution.md` |
| Synchronization and missing-event protocol | `62-synchronization.md`, `63-event-dependencies.md` |
| Error and capability registries, version negotiation | `80-errors.md`, `81-versioning-and-capabilities.md` |
| MLS identity binding and event representation | `25-mls.md`, `34.11` |
| Group and membership lifecycle | `53-contexts-and-membership.md` |
| Profile, follower/following, search, notification semantics | `51-profiles.md`, `50-social-relationships.md`, `71-search.md`, `72-notifications.md` |
| Media protocol | `56-media-and-files.md` |
| Object-storage API, retention, replication | `65-object-storage.md`, `60.5` |
| Complete cryptographic and serialization test vectors | `test-vectors/` |
| Interoperability test suite | `examples/` and `test-vectors/` |
| Security audit of the cryptographic composition | `90-security.md` |
| Security review of federation authentication | `61-federation-authentication.md`, `92-threat-model.md` |
| Metadata and privacy analysis | `91-privacy.md` |
| Downgrade and compatibility analysis | `81-versioning-and-capabilities.md` |

Until these are complete, the protocol remains a foundational draft rather than a final wire-level standard.

## 101.6 Test requirements

Before an implementation is considered protocol-compatible it SHOULD pass serialization, cryptographic, identity, device, event, DAG, federation, encryption, MLS, deletion, username, synchronization, and negative/security tests. Negative tests are especially important; the mandatory negative behaviors are listed in `82.3`.

## 101.7 Reference artifacts

* `schemas/`: machine-readable CDDL for all normative CBOR structures.
* `examples/`: complete protocol exchanges.
* `test-vectors/`: byte-exact vectors for the constructions fixed by `decisions/0011` to `0013`, plus the coverage plan for the rest.
* `decisions/`: design decisions behind this specification.