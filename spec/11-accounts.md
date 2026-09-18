# 11. Accounts

This module defines the account concept: the permanent cryptographic identity of a Loopable participant.

## 11.1 Account identity

An account is a permanent Loopable cryptographic identity controlled by a user. Every account has exactly one permanent Ed25519 signing key pair, the account identity key.

The account identity public key is the cryptographic root of the account. It MUST NOT change for the lifetime of the account.

The account identity private key MUST be generated from a cryptographically secure random source, MUST be stored in secure storage per `90-security.md`, and MUST NOT be transmitted over the network in any form.

## 11.2 Account identifier

The account identifier is derived from the account identity public key as defined in `10-identifiers.md` (section `10.5`):

The `account_id` wire form is `SHA-256("loopable-account-id" 0x00 || identity_public_key)`. The text form is base32lower.

The account identifier does not depend on username, instance hostname, device, email, or password. Changing any of those MUST NOT change the account identifier.

## 11.3 Account creation

Account creation is the process of generating an identity key pair and registering the account with an instance. Registration is defined in `40-account-lifecycle.md`.

The first device of an account is authorized directly by the account identity key through a `FirstDeviceAuthorization` record carried in `ACCOUNT_CREATED`, per `34.3`. That record binds the permanent account identity to the first device's Ed25519 signing public key and X25519 encryption public key, and is verifiable from the identity public key, the record, and the identity signature alone (`22.9`). The instance is not a trust anchor for the first device.

Accounts are never "claimed" cryptographically by an instance. An instance MAY host an account and enforce its own local membership policy, but the account identity key is the only authority for account-level state.

## 11.4 Canonical handle

A user-facing canonical handle has the form:

```text
@username:hostname
```

where `username` is defined by the grammar in `11.6` and `hostname` is the canonical form of the account's current home instance hostname, per `13-instances.md`.

The handle is a routing and display convenience. The canonical cryptographic identity is the account identity key. A client MUST NOT use a username alone, or a handle alone, as a cryptographic identity.

Two handles with the same username on different hostnames identify different accounts. For example `@alice:test.org` and `@alice:example.org` are different accounts even if one of them is a typo.

## 11.5 Handle canonicalization

A handle is canonical when:

1. The username is in its canonical lowercase form, per `11.6`.
2. The hostname is in its canonical form, per `13.4`.
3. It contains exactly one `@`, one `:`, and no other punctuation or whitespace.

Implementations MUST produce and compare handles in canonical form.

## 11.6 Username grammar

A username is the local, mutable, human-readable name of an account.

The canonical username MUST match:

```text
^[a-z0-9]([a-z0-9_]{0,30}[a-z0-9])?$
```

with the additional rule that a single-character username is a single `[a-z0-9]` character. In words:

1. The username is 1 to 32 characters.
2. Characters are lowercase ASCII letters `a` to `z`, digits `0` to `9`, and the underscore `_`.
3. The first and last character MUST be a lowercase letter or digit.
4. Underscores are allowed only between other characters.

An account MAY register any username that matches the grammar and is available on its instance. Username availability and reservation are instance membership state, defined in `40-account-lifecycle.md`.

Normalization requirements:

1. Before validation, implementations MUST apply Unicode normalization form C (NFC) and full case folding to the proposed local part.
2. After case folding, the username MUST be stored and compared in lowercase only.
3. Implementations MUST NOT apply any other normalization rules. Unicode confusables are handled by instance-local policy and by the restricted character set above.

A username change is a username-change event per `40-account-lifecycle.md` and does not change the account identity or the `account_id`.

The reserved username list is empty for version 0.1. Username availability is instance-local policy, per `40-account-lifecycle.md`.

## 11.7 Accounts and privacy

An account is not automatically discoverable by people outside the instances and contexts it participates in. Account lookup, profile visibility, and enumeration limits are defined in `13-instances.md`, `51-profiles.md`, and `71-search.md`. There is no global public user directory in the protocol, per `91-privacy.md`.

## 11.8 Account attributes

An account has the following protocol-relevant state:

* `account_id` (immutable).
* Account identity public key (immutable).
* Username, which may change, per `40-account-lifecycle.md`.
* Home instance identity, per `13-instances.md`.
* Trusted device, per `12-devices.md`.
* Authorization state, per `42-identity-and-authorization.md`.
* Lifecycle state (active, deleted), per `40-account-lifecycle.md`.

None of this state is stored in plaintext except where required for protocol operation (routing, membership state per `13.5`).