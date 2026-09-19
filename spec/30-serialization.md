# 30. Serialization

This module is the authoritative definition of canonical serialization for all protocol data.

## 30.1 Format

All signed and encrypted protocol data is serialized using CBOR, RFC 8949, with the deterministic encoding rules of this module. There is exactly one canonical encoding for any given protocol object.

JSON MUST NOT be used as the cryptographic signing or encryption representation. Human-readable JSON MAY be provided as a debugging or API representation only when it maps unambiguously to the canonical binary representation.

## 30.2 Deterministic encoding rules

An implementation producing the canonical encoding MUST:

1. Use the preferred serialization of every value: the shortest encoding that represents the value, per RFC 8949 section 4.2.1.
2. Encode unsigned integers using RFC 8949 preferred serialization. Values `0..23` use the immediate-value form; larger values use the shortest additional-information form that represents them. Never expand an integer that fits in a shorter form.
3. Encode text and byte strings with definite-length headers only. Indefinite-length encoding MUST NOT be used.
4. Encode arrays and maps with definite-length headers only, and only as the number of elements they hold.
5. Sort the entries of every map by their keys using the canonical order defined in `30.3`.
6. Encode text strings as UTF-8. The bytes MUST be valid UTF-8 with no unpaired surrogates, and MUST NOT use non-shortest form encodings.
7. Encode byte strings by value, with no changes.
8. Not use floating point values anywhere in protocol data unless a specific module says otherwise. All protocol numbers are unsigned integers.
9. Not use CBOR semantic tags. A protocol object MUST NOT contain any tag value; if the decoder encounters a tag, the input MUST be rejected.
10. Not use booleans, null, or undefined where a map can simply omit the field, per `01.6`.

## 30.3 Canonical map ordering

Map entries MUST be sorted by key such that:

1. Integer keys sort by numeric value ascending.
2. For length-differing keys of the same class, shorter keys sort first.

Because `31-wire-types.md` defines all protocol map keys as unsigned integers, the effective canonical order is numeric ascending. Implementations MUST still implement the length-then-bytewise rule for correctness when validating data that contains string keys in bodies they otherwise parse.

Sorting MUST be applied to the bytes actually encoded. Two implementations given identical logical protocol data MUST produce identical canonical bytes.

## 30.4 Unknown fields

A map MAY contain integer keys that a decoder does not recognize.

1. A decoder MUST preserve unknown integer-keyed fields losslessly when re-encoding a signed structure for signature verification, per `22-signatures.md`.
2. A decoder MUST NOT reject a structure solely because it contains an unknown integer key.
3. A decoder MUST ignore the semantic content of unknown fields unless a later negotiation (per `81-versioning-and-capabilities.md`) defines them.

This rule makes minor-version extensions of the wire format possible without breaking canonical signature reconstruction.

## 30.5 Canonical encoding of a full structure

The canonical encoding of a structure `S` is:

```text
deterministic_cbor(S)
```

obtained by applying `30.2` to the decoded form of `S`. There is no alternative encoding.

## 30.6 Signature and encryption input

Signed data signs `label || deterministic_cbor(S_without_signature_field)` per `22-signatures.md`. Encrypted data authenticates associated data built from canonical sub-structures per `23-encryption.md` and `24-hpke.md`. Both procedures rely on `30.2` and `30.3` so that transcript bytes are reproducible.

## 30.7 Text normalization

Text strings that are protocol values (fields, usernames, hostnames, versions) MUST be in their canonical form before encoding:

* Usernames: `11-accounts.md`.
* Hostnames: `13-instances.md`.
* Protocol versions: `81-versioning-and-capabilities.md`.

An implementation MUST NOT emit non-canonical text and then rely on receivers to normalize before signature verification; the bytes signed are the bytes verified.

## 30.8 Duplicate keys

A map MUST NOT contain duplicate keys. If a decoder encounters a map with duplicate keys, the input MUST be rejected as malformed (error code `E_MALFORMED_ENCODING`, `80-errors.md`).

## 30.9 Deterministic CBOR and CDDL

The CDDL definitions in `schemas/` describe the permitted data model. They do not by themselves enforce canonical ordering or preferred serialization. The rules of this module are normative for producing canonical bytes, per `schemas/README.md`.
