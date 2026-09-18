# 23. Encryption

This module is the authoritative definition of how ordinary Loopable objects are encrypted and decrypted with AES-256-GCM, and of the associated data that binds a ciphertext to its object version.

## 23.1 Scope

Every Loopable social object MUST be encrypted before being persisted as a protocol object, including objects whose authorization policy treats them as public. There is no plaintext-content mode. This construction defines the object content encryption; the envelope that carries the result is defined in `33-object-envelope.md`.

## 23.2 Parameters

| Parameter | Value |
| --------- | ----- |
| Algorithm | AES-256-GCM (RFC 5116, NIST SP 800-38D) |
| Key (CEK) | 256 bits (32 bytes), fresh per independently encrypted object version |
| Nonce | 96 bits (12 bytes), fresh per encryption operation |
| Authentication tag | 128 bits (16 bytes) |
| Plaintext input | Deterministic CBOR of the object content (this module, `23.3`) |
| AAD input | The exact bytes of `23.4` |
| Ciphertext output | Ciphertext followed by the 16-byte tag (this module, `23.3`) |

## 23.3 Encryption procedure

To encrypt a plaintext object payload `P`, an implementation MUST:

1. Generate a fresh random 256-bit content-encryption key `CEK` (`21-key-management.md`).
2. Generate a fresh random 96-bit nonce `N` (`20.11`).
3. Construct the associated data `AAD` per `23.4`.
4. Encrypt with AES-256-GCM: `(ciphertext, tag) = AES-256-GCM-Encrypt(CEK, N, P, AAD)`.
5. Produce the ciphertext field value as `ciphertext || tag` (ciphertext followed by the 16-byte tag).
6. Store `N` and the ciphertext-with-tag in the object envelope per `33-object-envelope.md`.

The plaintext `P` is the canonical CBOR encoding of the object's content structure, which is the payload portion defined by the object type in `33-object-envelope.md` and `55-content.md` for each content kind.

## 23.4 Associated data

The AES-GCM associated data MUST authenticate every security-relevant unencrypted object field, including the object version. This section is the single authoritative AAD definition for object encryption; no other module may define a different one.

The associated data is the byte string:

```text
AAD = "loopable-object-v1" 0x00 || deterministic_cbor(ObjectSecurityMetadata)
```

where `ObjectSecurityMetadata` is the following canonical CBOR map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `protocol_version` | text | yes | Protocol version of the object, `"0.1"`. |
| 1 | `object_id` | bytes(32) | yes | The object identifier, per `10.4`. |
| 2 | `object_type` | uint | yes | The object type code from `33.7`. |
| 3 | `encryption_suite` | uint | yes | `0` for the mandatory AES-256-GCM suite. |
| 4 | `version_id` | bytes(32) | yes | The version identifier, per `55-content.md`. |

The numeric map keys and types above are normative and MUST match the object envelope field keys of `33-object-envelope.md`. `deterministic_cbor` follows `30-serialization.md`. In protocol version 0.1 every object has a version identity, so the `version_id` entry MUST always be present.

Because `object_id`, `object_type`, `encryption_suite`, and `version_id` are authenticated, an attacker cannot move a ciphertext between objects, between object types, or between versions of the same object, and cannot substitute a different suite, without causing authentication failure.

## 23.5 Decryption procedure

To decrypt an encrypted object, an implementation MUST:

1. Validate the object envelope per `33-object-envelope.md`.
2. Reconstruct `AAD` from the envelope fields per `23.4`.
3. Locate the recipient key record for the current device per `24.6`.
4. Recover the `CEK` from that recipient record per `24.7`.
5. Split the ciphertext field into ciphertext and the trailing 16-byte tag.
6. Decrypt with AES-256-GCM: `AES-256-GCM-Decrypt(CEK, N, ciphertext, tag, AAD)`.
7. Present plaintext only after successful authentication.

If the GCM tag does not authenticate, the implementation MUST treat the ciphertext as invalid, MUST NOT return partially decrypted plaintext, and MUST NOT silently ignore the failure. Behavior maps to error code `E_DECRYPTION_FAILED` per `80-errors.md`.

## 23.6 Nonce handling

The nonce MUST be unique for every encryption under a given AES-256-GCM key. The protocol generates a fresh CEK for each independently encrypted object version, so nonce reuse across objects is not a practical risk, but generators MUST still produce a fresh random nonce for every encryption operation and MUST NOT reuse a nonce with a different plaintext under the same CEK. An implementation MUST NOT derive the nonce deterministically from the key, the plaintext, the object identifier, or the version identifier.

## 23.7 Plaintext construction rules

The plaintext content of an object is itself canonical CBOR, per `30-serialization.md`. Application content MUST be normalized to its canonical form before encryption so that the same logical content produces the same plaintext bytes. Two independently produced encryptions of the same plaintext MUST NOT be expected to produce identical ciphertext, because CEK and nonce are random.

## 23.8 Instances and plaintext

An instance MUST be able to store, forward, verify the envelope integrity, synchronize, and enforce storage policy without possessing plaintext decryption keys. The inability to decrypt a normal social object is intentional and MUST NOT be treated as a protocol error, per `65-object-storage.md` and `91-privacy.md`.