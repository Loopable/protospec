# 10. Identifiers

This module is the authoritative definition of protocol identifiers, their wire form, their canonical text form, and their derivation rules.

## 10.1 Identifier types

The protocol defines the following identifier types. Every identifier exists in two forms: a wire form (a CBOR byte string) and a canonical text form used in handles, configuration, and display.

| Identifier | Wire length | Text form | Definition |
| ---------- | ----------- | --------- | ---------- |
| `account_id` | 32 bytes | base32lower, 52 chars | `11-accounts.md` |
| `instance_id` | 32 bytes | base32lower, 52 chars | `13-instances.md` |
| `event_id` | 16 bytes | base32lower, 26 chars | `32-event-envelope.md` |
| `object_id` | 32 bytes | base32lower, 52 chars | `33-object-envelope.md` |
| `device_id` | 16 bytes | base32lower, 26 chars | `12-devices.md` |
| `request_id` | 16 bytes | base32lower, 26 chars | `61-federation-authentication.md` |
| `key_id` | 16 bytes | base32lower, 26 chars | `13-instances.md` (instance operational key identifier) |
| `recipient_key_id` | 16 bytes | base32lower, 26 chars | `24-hpke.md` |
| `version_id` | 32 bytes | base32lower, 52 chars | `55-content.md` |
| `group_id` | 16 bytes | base32lower, 26 chars | `25-mls.md` (MLS `group_id`) |

## 10.2 Base32 encoding

The canonical text form of all identifiers uses the alphabet of RFC 4648 base32 (A-Z, 2-7), lowercased, with no padding and no separators.

The encoding and decoding rules are:

1. The input is the raw byte sequence of the identifier.
2. Encode the bytes with RFC 4648 base32 using the standard alphabet.
3. Convert the alphabet to lowercase.
4. Remove all padding characters (the `=` characters).

The output length is fixed by the input length as shown in the table above. Implementations MUST NOT emit padding in the canonical text form, MUST NOT accept padding in the canonical text form, MUST treat the text form as case-insensitive on input and lowercase on output, and MUST reject a text form whose length does not match the expected identifier type.

## 10.3 Wire form

Identifiers are CBOR byte strings of the exact wire length in the table. A byte string of any other length MUST be rejected. Text form is never used on the wire for an identifier that has a defined byte wire form.

## 10.4 Random identifiers

Some identifiers are cryptographically random:

| Identifier | Entropy | Source |
| ---------- | ------- | ------ |
| `event_id` | 128 bits | `10.6` |
| `object_id` | 256 bits | `10.6` |
| `device_id` | 128 bits | `10.6` |
| `request_id` | 128 bits | `10.6` |
| `version_id` | 256 bits | `10.6` |

Random identifiers MUST be generated from a cryptographically secure random number generator appropriate for the host platform, per `90-security.md`. They MUST be generated independently of any plaintext, ciphertext, timestamp, account, sequence, or other protocol data, and MUST NOT be derived as hashes of content.

## 10.5 Derived identifiers

Two identifiers are derived deterministically from a public key:

| Identifier | Derivation |
| ---------- | ---------- |
| `account_id` | `SHA-256("loopable-account-id" 0x00 || identity_public_key)` over the Ed25519 account identity public key |
| `instance_id` | `SHA-256("loopable-instance-id" 0x00 || root_public_key)` over the Ed25519 instance root public key |

The byte constant is the ASCII bytes of the string followed by a single 0x00 byte. The two derivation strings are distinct domain-separation labels registered in `20-cryptographic-primitives.md`.

The resulting 32 bytes are the wire form; the text form is the base32lower encoding per `10.2`.

Derived identifiers MUST remain stable for the lifetime of the underlying key. If a public key changes, its derived identifier changes with it.

`recipient_key_id` (`24-hpke.md`) is also derived, by hashing a recipient key descriptor. It is a key identifier, not an object or account identifier, and is recomputable by any party that knows the descriptor.

`envelope_id` (`33-object-envelope.md`) is a derived identifier of a complete object envelope. It is not carried on the wire in version 0.1 and is not an authority for any security decision.

## 10.6 Random identifier generation procedure

An implementation generating a random identifier MUST:

1. Obtain `N` bytes from a cryptographically secure random source, where `N` is the wire length from `10.1`.
2. Use those bytes directly as the identifier.
3. NOT apply any transformation, formatting, or content-derived filtering.

## 10.7 Text form parsing rules

An implementation parsing a canonical text-form identifier MUST:

1. Remove any case information by lowercasing the input.
2. Verify the length matches the expected identifier type (52 or 26 characters as appropriate).
3. Verify every character is in the base32 alphabet (`a` to `z`, `2` to `7`).
4. Decode from base32 and verify the result has exactly the expected byte length.
5. Reject the identifier on any failure.

## 10.8 Uniqueness

Identifiers of the same type MUST be globally unique. Derived identifiers are unique by construction when public keys are unique. Random identifiers have negligible collision probability when generated per `10.6`.

Implementations MUST reject an event whose `event_id` collides with a previously accepted `event_id` while the canonical event bytes differ. Such a conflict is a protocol integrity error and MUST cause rejection of the new event per `82-limits-and-validation.md`.

## 10.9 Usage outside the protocol

Identifier text forms MAY be used in configuration files, URLs, and user-facing diagnostics. They MUST NOT be used as cryptographic authority on their own; a signature must always accompany protocol data, per `22-signatures.md`.