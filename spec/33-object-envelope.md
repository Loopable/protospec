# 33. Object envelope

This module is the authoritative definition of the encrypted object envelope, the derived envelope identifier, and the object type registry.

## 33.1 Purpose

An object is encrypted application data: a post, reply, profile, image, video, file, direct message, relationship metadata, membership metadata, group metadata, notification, or MLS message. Every object is encrypted before it is persisted as a protocol object, even when its audience policy is public.

## 33.2 Object map

An encrypted object is a CBOR map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `protocol_version` | text | yes | Protocol version `"0.1"`. |
| 1 | `object_id` | bytes(32) | yes | Random object identifier, per `10.4`. |
| 2 | `object_type` | uint | yes | Object type code from `33.7`. |
| 3 | `encryption_suite` | uint | yes | `0` for the mandatory AES-256-GCM suite; `1` for streaming media encryption (`35-media-encryption.md`). |
| 4 | `version_id` | bytes(32) | yes | Version of the logical object, per `55-content.md`. |
| 5 | `nonce` | bytes | yes | `12` bytes for suite `0` (AES-GCM nonce, per `23.6`); empty for suite `1` (the stream header carries its own salt and nonce prefix, per `35.3`). |
| 6 | `ciphertext` | bytes | yes | `ciphertext || tag` for suite `0`, per `23.3`; the full stream blob for suite `1`, per `35.3`. |
| 7 | `recipients` | array&lt;recipient_key_record&gt; | yes | Recipient key records, per `24.6`. |
| 8 | `metadata` | map | no | Unauthenticated protocol metadata, per `33.6`. |

There is no envelope-level key identifier. Each recipient record carries its own `recipient_key_id` per `24.6`, and the associated data of `23.4` binds the object-level fields above.

## 33.3 Field semantics

* `object_id` is random and independent of plaintext, per `10.4`. Object IDs MUST NOT be hashes of plaintext and MUST NOT expose plaintext content.
* `object_type` selects how the plaintext is parsed, per `33.7` and `55-content.md`.
* `encryption_suite` is `0` for the mandatory AES-256-GCM suite and `1` for streaming media encryption (`35-media-encryption.md`). The suite of an envelope MUST match the object type: media objects (`object_type` `3`) use suite `1`; all other object types use suite `0`. The meaning of an encryption-suite identifier MUST never change, per `81-versioning-and-capabilities.md`.
* `version_id` identifies the specific version of the logical object, per `55-content.md`. In protocol version 0.1 every object has a version identity, so the field MUST be present. It MUST be authenticated by the associated data, per `23.4`.
* `nonce` and `ciphertext` are produced per `23.3` for suite `0` and per `35-media-encryption.md` for suite `1`.
* `recipients` carries the key material for authorized recipients, per `24.6` and `25.6`.

### envelope_id

`envelope_id` is a derived identifier for a complete object envelope. It is computed after the envelope is fully assembled and is not carried in the envelope in version 0.1:

```text
envelope_id = SHA-256(
    "loopable-object-envelope-v1" 0x00 ||
    deterministic_cbor(complete object map))
```

where `deterministic_cbor` follows `30-serialization.md` and the complete object map includes every present field, including `recipients`. `envelope_id` MAY be used by implementations for deduplication, caching, logging, and diagnostics. It is not required to produce the ciphertext, and it MUST NOT be used as an input to HPKE (`24.4`, `24.5`) or as a recipient key identifier. Changing any envelope field changes `envelope_id`.

## 33.4 Associated data

The AES-GCM associated data for every object is defined authoritatively in `23.4`. It authenticates `protocol_version`, `object_id`, `object_type`, `encryption_suite`, and `version_id`. There is no second definition; modules and implementations MUST construct the associated data exactly as `23.4` specifies.

## 33.5 Recipient rules

Every recipient MUST receive independently protected key material (an HPKE record with its own `recipient_key_id`, or MLS group membership), per `24.3` and `24.6`. An unauthorized recipient MUST NOT receive usable key material. The plaintext CEK MUST NOT be sent directly over federation.

## 33.6 Metadata

The optional `metadata` map is not authenticated by the AES-GCM associated data. It MUST NOT carry keys found in the authenticated fields or sensitive plaintext. Implementations MUST treat every metadata value as an attacker-controlled hint. Metadata MUST NOT affect recipient selection, authorization, object identity, object type, version selection, decryption-key selection, event validity, or federation authorization. Instances MAY read lossless metadata for non-authoritative routing and storage policy. Any change to the `metadata` map MUST NOT affect the ciphertext or its authentication.

## 33.7 Object type registry

| Code | Object type | Content schema |
| ---- | ----------- | -------------- |
| 0 | `post` | `55-content.md` |
| 1 | `reply` | `55-content.md` |
| 2 | `profile` | `51-profiles.md` |
| 3 | `media` | `56-media-and-files.md` |
| 4 | `direct_message` | `54-messaging.md` |
| 5 | `relationship` | `50-social-relationships.md` |
| 6 | `membership` | `53-contexts-and-membership.md` |
| 7 | `group_metadata` | `53-contexts-and-membership.md` |
| 8 | `notification` | `72-notifications.md` |
| 9 | `mls_message` | `25-mls.md` |

Object types are registered per `101-implementation-requirements.md`. Unknown mandatory object types MUST NOT be applied; unknown optional object types MAY be retained as opaque data, per `82-limits-and-validation.md`.

## 33.8 Object authenticity

An encrypted object MUST contain enough authenticated metadata to prevent object substitution, ciphertext swapping, object-type confusion, version confusion, recipient confusion, and object-ID substitution. The AES-GCM associated data of `33.4` provides that binding. A relay MUST NOT modify authenticated ciphertext or any authenticated field, per `65-object-storage.md`.

## 33.9 Unauthorized ciphertext

An instance or client receiving ciphertext it cannot decrypt MUST NOT treat that as a protocol error. It is normal Loopable behavior, per `23.8` and `65-object-storage.md`.
