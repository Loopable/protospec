# 00. Introduction

## 0.1 Purpose

This document is the normative specification of the Loopable Protocol, version 0.1.

Loopable is a decentralized, privacy-first social networking protocol. "Decentralized" means that no single operator controls the network and that independent implementations communicate with each other through federation. "Privacy-first" means that private data is protected cryptographically rather than by trusting every instance or service that handles it.

The protocol defines account identities, cryptographic identities, devices, device authorization and revocation, usernames, instances, instance identities, instance membership, profiles, social relationships, encrypted objects, encrypted media, events, event signatures, event dependency graphs, object encryption, key distribution, group encryption, federation, synchronization, missing-event recovery, object storage, object deletion, profile visibility, follower and following visibility, account lookup, instance discovery boundaries, protocol versioning, security requirements, and interoperability requirements.

The protocol does NOT define a specific official client UI, a specific database implementation, a specific object-storage implementation, a global moderation policy, a global instance ranking system, a global public user directory, a centralized account-recovery mechanism, a requirement that all instances use the same software, or a requirement that all instances be operated by a single foundation.

The official Loopable implementation is an implementation of this protocol. It is not the protocol itself.

## 0.2 Design goals

The protocol follows these requirements:

1. The network should feel unified to a normal user. Federation concepts MUST NOT be required in the user interface during normal use.
2. Instances are infrastructure. They provide connectivity, federation, membership management, encrypted object storage, synchronization, local moderation, rate limiting, resource management, account hosting, and protocol endpoints. An instance is not automatically trusted with plaintext user data.
3. Encryption is mandatory. Loopable has no plaintext-content mode. All social objects MUST be encrypted before being persisted as protocol objects, including objects whose authorization policy treats them as public.
4. Identity and storage are separate. The instance hosting an account does not have to be the instance storing every object associated with that account.
5. Instances are not the cryptographic root of an account. An instance MUST NOT be able to replace an account identity key, create an account device, recover a lost account identity, forge account activity, or impersonate an account.

"Public" content therefore means content that any authorized Loopable participant satisfying the object audience policy may obtain decryption material for. It does not mean plaintext stored in an instance database.

## 0.3 Reading model

Each module in this specification separates three layers where applicable:

1. Abstract protocol semantics: what a concept means and what invariants it maintains.
2. Wire representation: the exact CBOR encoding and field layout.
3. Transport behavior: how the concept is exchanged between implementations.

A concept is defined once, in its authoritative module, and referenced elsewhere. Cross-references use the form `[module number. title](file.md#section)`.

Normative requirements use the keywords defined in `01-conventions.md`. Where this specification gives an exact algorithm, encoding, field size, validation procedure, or state transition, implementations MUST follow that definition and MUST NOT substitute an alternative mechanism merely because it appears functionally equivalent.

## 0.4 Glossary

Term definitions are given in the module where the term is introduced:

* Account: `11-accounts.md`.
* Account identity key: `22-signatures.md` and `11-accounts.md`.
* Device and trusted device: `12-devices.md`.
* Instance and instance identity: `13-instances.md`.
* Object: `33-object-envelope.md`.
* Event and event DAG: `32-event-envelope.md` and `63-event-dependencies.md`.
* Context: `53-contexts-and-membership.md`.
* Audience: `33-object-envelope.md`.
* Federation: `60-federation.md`.