# 0001: Domain-stamped identifiers and ID derivation

* Status: accepted
* Basis: `spec/10-identifiers.md`, `spec/11-accounts.md`

## Context

The draft defines account and instance IDs, but not their derivation from keys, and it uses 10-byte alphanumeric identifiers with a separate text form.

## Alternatives

1. Use the public key directly as the ID. Rejected: massaging between text and byte forms, and public keys in key positions are awkward to cite.
2. Use a randomly generated ID with a vetting table. Rejected: nothing ties the ID to the key; a malicious account could forge another account's verified event by ID squatting.
3. Derive the ID from the public key via a domain-separated hash. Chosen.

## Decision

`account_id = SHA-256("loopable-account-id" || 0x00 || identity_public_key)` and the analogous instance derivation (`spec/10-identifiers.md` 10.5). Byte sizes are fixed at 16 or 32 bytes as specified there. Text form is base32lower without padding.

## Consequences

* Whether the ID refers to a key or an instance is immediately derivable from length (16 vs 32 bytes) and from the enclosing envelope position.
* No registration of account IDs by instances; an instance can confirm a claimed account IDs derivation locally.
* Resolves the "findable identity direction" question: an ID containing the instance's derived value routes lookups homeward without a global directory.