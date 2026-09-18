# 0013: Object AAD binds the object version

* Status: accepted
* Basis: `spec/23-encryption.md` 23.4, `spec/33-object-envelope.md` 33.4

## Context

Mutable objects have versions (`spec/55-content.md`), but the object AES-GCM associated data did not authenticate the version identifier. An attacker who could move a ciphertext between versions of the same object, or replace the version metadata a client uses to fetch, could cause a client to treat one version's ciphertext as another version's content. The envelope also lacked an authoritative, complete AAD definition: other modules referenced a structure that was not fully specified.

## Alternatives

1. Leave `version_id` outside the AAD and rely on application checks. Rejected: application checks are not cryptographic binding.
2. Fold `version_id` into the HPKE `info`. Rejected: HPKE protects only the CEK, not the object ciphertext, and would conflate key wrapping with content authentication.
3. Define a single authoritative `ObjectSecurityMetadata` map that includes `version_id` when the envelope carries it, and use it as the AES-GCM AAD. Chosen.

## Decision

`spec/23-encryption.md` 23.4 is the single authoritative AAD definition: `AAD = "loopable-object-v1" 0x00 || deterministic_cbor(ObjectSecurityMetadata)`, where `ObjectSecurityMetadata` is the canonical map with keys `0 protocol_version`, `1 object_id`, `2 object_type`, `3 encryption_suite`, and `4 version_id` present exactly when the envelope carries a `version_id`. Object envelope field numbers match these keys. No other module may define a different AAD.

## Consequences

* Ciphertexts cannot be moved between objects, object types, suites, or versions without authentication failure.
* `version_id` appears in both the envelope and the AAD; the envelope carries it, the AAD authenticates it.
* `decisions/0014` refines the presence rule: in protocol version 0.1 the envelope always carries `version_id`.
* Decryption failure for any AAD mismatch maps to `E_DECRYPTION_FAILED`.
