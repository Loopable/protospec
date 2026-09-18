# 0012: HPKE recipient identifiers must be acyclic

* Status: accepted
* Basis: `spec/24-hpke.md` 24.4, 24.5, 24.8; `spec/33-object-envelope.md` 33.3

## Context

The earlier HPKE definition derived an envelope-level `key_id` from a canonical encoding of recipient records, which contain the HPKE outputs `enc` and `ct`. It also defined a second, conflicting `key_id` as a hash of the public key. Both variants were unusable: the first is circular (the identifier is needed to compute the very ciphertext it hashes), and two conflicting definitions cannot both be authoritative.

## Alternatives

1. Keep a single envelope-level `key_id` computed after encryption. Rejected: it cannot be an input to HPKE `info`, because `info` is required before encryption.
2. Drop recipient identifiers entirely and match recipients by `(account_id, device_id)` only. Rejected: it loses a cheap, stable handle for key rotation and diagnostics.
3. Define a per-recipient `recipient_key_id` computed from a pre-encryption key descriptor, remove the envelope-level key identifier, and derive a separate post-assembly `envelope_id`. Chosen.

## Decision

`recipient_key_id` is the first 16 bytes of `SHA-256("loopable-recipient-key-id-v1" 0x00 || deterministic_cbor(recipient_key_descriptor))`, where the descriptor contains only pre-encryption key data (`recipient_kind`, `account_id`, `device_id`, `recipient_public_key`). The HPKE `info` is `"loopable-hpke-object-key-v1" 0x00 || object_id || recipient_key_id || "0.1"`. For MLS group records, `recipient_key_id` is the first 16 bytes of the `group_id`.

The object envelope has no key identifier. The optional derived `envelope_id` is `SHA-256("loopable-object-envelope-v1" 0x00 || deterministic_cbor(complete envelope))` and is computed after assembly. It MUST NOT be an HPKE input.

## Consequences

* Every HPKE input is computable before encryption; construction order is normative in `spec/24-hpke.md` 24.8.
* Recipient records use `recipient_key_id` at field `3`; the envelope no longer has a field `4` key identifier.
* `spec/10-identifiers.md` distinguishes `recipient_key_id` (this construction) from `key_id` (instance operational keys, `spec/13-instances.md`).
* Two new domain-separation labels are registered in `spec/20-cryptographic-primitives.md` 20.12.
