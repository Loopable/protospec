# 22. Signatures

This module is the authoritative definition of how protocol data is signed and how signatures are verified.

## 22.1 General rule

All signed protocol data MUST be signed over a domain-separated byte sequence constructed from the canonical binary representation of that data, as defined in `30-serialization.md`. The signature MUST be Ed25519 over those exact bytes. JSON MUST NOT be used as the cryptographic signing representation.

## 22.2 Canonical signature input

The canonical signature input for a signed structure is:

```text
signature_input = domain_separation_label ||
                  canonical_encoding_of_unsigned_structure
```

where:

* `domain_separation_label` is the registered label from `20.12`, including its trailing `0x00` byte;
* `canonical_encoding_of_unsigned_structure` is the deterministic CBOR encoding, per `30-serialization.md`, of the structure with the signature field omitted.

The signature field is the map entry whose key is the signature key defined for the structure. To compute or verify, an implementation MUST omit that entry from the map, apply deterministic CBOR encoding to the result, and use the label plus those bytes.

## 22.3 Event signatures

The event envelope is defined in `32-event-envelope.md`. Its signature field key is `9`.

The event signature input is:

```text
"loopable-event-v1" 0x00 || deterministic_cbor(event map without key 9)
```

For `ACCOUNT_CREATED`, the signature is computed with the account identity's
Ed25519 private key. For every other event, it is computed with the signing
device's Ed25519 private key:

```text
Ed25519.Sign(event_signing_private_key, signature_input)
```

An event MUST NOT be accepted without a valid signature computed over exactly this input.

## 22.4 Session and connection signatures

Federation request signatures use the separate registered label `loopable-federation-request-v1` `0x00` and are defined in `61-federation-authentication.md`.

No other protocol operation MAY reuse the event signature domain.

## 22.5 Event verification

A receiving implementation MUST verify an event in the following order. Failure at any step MUST cause rejection of the event:

1. Decode the canonical structure; reject malformed encoding.
2. Validate field types and lengths against `32-event-envelope.md` and `31-wire-types.md`.
3. Validate the protocol version per `81-versioning-and-capabilities.md`.
4. Validate the account and device identifiers per `10-identifiers.md`.
5. If the event is `ACCOUNT_CREATED`, verify its signature with the account identity public key derived from the event, then validate its `FirstDeviceAuthorization` per `34.3` and `22.9`. Do not resolve a device authorization chain. For every other event, resolve the device authorization chain and validate it per `42-identity-and-authorization.md`.
6. Verify the event signature with the key selected in step 5 over the signature input of `22.3`.
7. Validate event dependencies per `63-event-dependencies.md`.
8. Validate object references per `33-object-envelope.md`.
9. Validate the event type's authorization requirements per `34-event-types.md`.

Verdicts and states are defined in `100-conformance.md`.

## 22.6 Signature verification failure

A failed signature verification MUST be treated as a protocol error with code `E_SIGNATURE_INVALID` (`80-errors.md`). An implementation MUST NOT accept an event with an invalid signature, MUST NOT partially apply such an event, and MUST NOT retry it against other keys indefinitely.

## 22.7 Non-repudiation scope

A valid event signature proves the signing device produced the event. It does not by itself prove the event is authorized to have the effect it claims; authorization is validated separately per `42-identity-and-authorization.md` and `34-event-types.md`.

## 22.8 Authenticity summary

An event is authentic only when all of the following hold:

```text
valid account identity      (42-identity-and-authorization.md, or the genesis event)
valid device authorization  (42-identity-and-authorization.md, non-genesis only)
valid event signature       (this module, 22.5)
valid event structure       (32-event-envelope.md)
valid dependencies          (63-event-dependencies.md)
```

Transport origin alone MUST NOT establish event authenticity.

## 22.9 First-device authorization signature

The first-device authorization record of `34.3` is signed by the account identity key. Its signature field is key `6`. The signature input is the general construction of `22.2` applied to that record:

```text
"loopable-first-device-authorization-v1" 0x00 ||
deterministic_cbor(first_device_authorization map without key 6)
```

The signature is:

```text
Ed25519.Sign(account_identity_private_key, signature_input)
```

The signature MUST cover every field of the record except the signature itself: `authorization_version`, `account_id`, `device_id`, `device_signing_public_key`, `device_encryption_public_key`, and `device_kind`. A validator MUST verify this signature using the account identity public key from the enclosing `ACCOUNT_CREATED` body, independently of the enclosing event signature. A failure maps to `E_SIGNATURE_INVALID` (`80-errors.md`).
