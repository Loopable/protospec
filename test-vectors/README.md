# Test vectors

Byte-exact vectors for deterministic Loopable Protocol operations, plus the generator that produces them.

The vectors cover the three constructions fixed by `decisions/0011`, `decisions/0012`, and `decisions/0013`, which could not be left without reproducible bytes. The rest of the protocol's coverage plan is listed at the end and is generated when the wire format freezes.

## Files

| File | Covers |
| ---- | ------ |
| `first-device-authorization.json` | `ACCOUNT_CREATED` and its signed `FirstDeviceAuthorization` record (`spec/34-event-types.md` 34.3, `spec/22-signatures.md` 22.9). |
| `hpke-object-key.json` | Recipient key descriptor, `recipient_key_id`, HPKE `info`, and CEK wrapping (`spec/24-hpke.md`). |
| `object-encryption-aad.json` | `ObjectSecurityMetadata`, the AES-GCM AAD, ciphertext, envelope, and derived `envelope_id` (`spec/23-encryption.md`, `spec/33-object-envelope.md`). |
| `generate.mjs` | Deterministic generator for all of the above. |

## Regenerating

```text
node test-vectors/generate.mjs
```

Requires Node.js 18 or newer. The generator uses only the Node `crypto` module and writes the three JSON files next to itself.

All inputs marked random in the protocol are instead derived from fixed seeds of the form `SHA-256("loopable-test-vector-v1" 0x00 || label)`, so the vectors are reproducible. Implementations MUST use a CSPRNG, per `spec/20-cryptographic-primitives.md` 20.11. The seeds in this directory are test data only and MUST NOT be used anywhere else.

## Handling

Every map is encoded with the deterministic CBOR rules of `spec/30-serialization.md`: preferred integer lengths, definite lengths, no tags, and map keys sorted by length then bytewise. Hex strings are the exact wire bytes.

Intermediates are included deliberately. A vector that lists only a final signature or ciphertext cannot show which bytes were signed or authenticated. Each vector therefore exposes the domain-separation input, the canonical map, and, for HPKE, the DH output, `shared_secret`, key schedule context, AEAD key, and base nonce.

## HPKE validation

The generator implements HPKE base mode (RFC 9180) for DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-256-GCM. Before emitting vectors it checks its KEM and key schedule against RFC 9180 Appendix A.1 (DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-128-GCM):

* derived sender and recipient public keys;
* KEM `shared_secret`;
* AEAD `key`;
* `base_nonce`.

All four match the published A.1 values. A.1 is used because RFC 9180 publishes no X25519 plus AES-256-GCM vector; the two suites share the KEM, KDF, labels, mode, and key schedule, and differ only in the AEAD key length. The generator exits with a non-zero status if any check fails.

## Negative vectors

Each JSON file ends with negative vectors. They are recorded as the exact bytes that a validator must reject, together with the required error code. They exist so an implementation can confirm that it rejects the right thing for the right reason, not merely that it rejects.

Examples:

* a first device with `device_kind = 1` (backup), which is forbidden (`E_FIRST_DEVICE_INVALID`);
* a signature computed over the signed map rather than the unsigned map (`E_SIGNATURE_INVALID`);
* a modified `recipient_key_id` or `object_id`, which changes HPKE `info` and makes decryption fail (`E_DECRYPTION_FAILED`);
* AAD bytes that alter `version_id`, `object_id`, or `object_type`, or that build the AAD without the required `version_id` (`E_DECRYPTION_FAILED`).

## Remaining coverage plan

Before 1.0, when `decisions/0004` and `decisions/0009` resolve and the wire format freezes, vectors are added for:

1. Identifier derivation and base32 text forms (`spec/10-identifiers.md`).
2. Event envelope signatures and canonical map ordering, including unknown integer-keyed fields preserved during re-encoding (`spec/22-signatures.md`, `spec/30-serialization.md`).
3. Deterministic CBOR rejection cases: duplicate keys, indefinite lengths, non-preferred integer encodings, and tags (`spec/30-serialization.md`, `spec/82-limits-and-validation.md`).
4. Device authorization and revocation chains (`spec/41-device-lifecycle.md`, `spec/42-identity-and-authorization.md`).
5. Federation request signatures (`spec/61-federation-authentication.md`).
6. MLS credential binding as published by RFC 9420 (`spec/25-mls.md`).

## Validation tooling

The repository has no CDDL validator available in this environment. `schemas/` is reviewed by hand against `spec/`, and the vectors above are generated and checked by `generate.mjs`. When a validator is available, the schemas SHOULD be checked against the decoded objects in these vectors.
