# 31. Wire types

This module defines the primitive wire types used by every field table in this specification, and the abbreviations used in those tables.

## 31.1 Type abbreviations

| Abbreviation | Meaning | CBOR major type / encoding |
| ------------ | ------- | -------------------------- |
| `uint` | Unsigned integer 0 to 2^64 - 1 | Major type 0 |
| `text` | UTF-8 text string | Major type 3 |
| `bytes` | Byte string, any length | Major type 2 |
| `bytes(n)` | Byte string, exactly n bytes | Major type 2, length n |
| `bytes0` | Byte string of length 0 | Major type 2, length 0 |
| `array<T>` | Definite-length array of type T | Major type 4 |
| `map` | Map with integer keys | Major type 5 |
| `bool` | Boolean value | Major type 7, value 20 or 21 |
| `time` | Epoch seconds since 1970-01-01T00:00:00Z, as `uint` | Major type 0 |

All protocol map keys are unsigned integers. All protocol values are unsigned integers, text, byte strings, arrays, or maps. No other CBOR major types appear in version 0.1 protocol data.

## 31.2 uint

Unsigned integer in `[0, 2^64 - 1]`. Encoded with preferred serialization, per `30.2`. Used for enums (small fixed constants), counters, and epoch timestamps.

## 31.3 text

UTF-8 text string. Used for strings whose canonical form is defined by `30.7`. The empty string is allowed only where a field table says so.

## 31.4 bytes and bytes(n)

Byte strings. `bytes(n)` fixes the length to exactly `n` bytes. Length is enforced by the decoder.

The following fixed-length byte strings are used:

| Wire type | Length | Purpose |
| --------- | ------ | ------- |
| `bytes(32)` | 32 | Account IDs, instance IDs, object IDs, public keys (Ed25519, X25519), SHA-256 digests, CEKs. |
| `bytes(16)` | 16 | Event IDs, device IDs, request IDs, key IDs, AES-GCM authentication tags. |
| `bytes(12)` | 12 | AES-GCM nonces. |
| `bytes(64)` | 64 | Ed25519 signatures. |

## 31.5 array and map

Arrays are definite-length. Maps use unsigned integer keys, canonical ordering per `30.3`, and no duplicate keys.

The CDDL in `schemas/` uses this same structure. The canonical encoding rules in `30-serialization.md` make the byte form of any such structure deterministic.

## 31.6 bool

Booleans appear only where a field table explicitly uses them. They MUST NOT be used as "requiredness" markers; optional fields are omitted per `01.6`.

## 31.7 time

Time values are unsigned integers of seconds since the Unix epoch, UTC. Division into years, months, and days is never required for protocol correctness. `created_at` and similar informational timestamps use `time`.

## 31.8 Enum codes

Where a field table describes an enum, the wire value is the numeric code shown in that module's enum table. Unknown enum codes MUST cause rejection unless the module explicitly allows extension. New enum codes are registered with the corresponding registry per `81-versioning-and-capabilities.md`.

## 31.9 Strictness

A decoder MUST reject:

* any value whose CBOR major type or length does not match the declared field type;
* duplicate map keys;
* non-canonical encodings of an integer (an integer that could be shorter);
* maps or arrays in indefinite-length form;
* CBOR tags;
* floating point values;
* text that is invalid UTF-8.

Rejection means error code `E_MALFORMED_ENCODING` (`80-errors.md`).