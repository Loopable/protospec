# CDDL schemas for Loopable Protocol 0.1

These files are machine-readable definitions of the wire structures in `spec/`. They describe the permitted CBOR data model of the protocol's deterministic-CBOR representation defined in `spec/30-serialization.md`.

## Relationship to the spec

`spec/` defines what the protocol means. This directory defines the machine-readable CBOR structure of that protocol. The specification remains the source of truth:

* Every normative CBOR structure in `spec/` has a schema here.
* Where CDDL cannot express a requirement (cryptographic processing, canonical ordering, signature domains, AAD construction, HPKE parameters, MLS integration, key lifecycle, state machines, cross-field constraints, semantic validation, authorization rules, temporal and replay requirements, error conditions, security and privacy requirements), the requirement lives in `spec/` and is authoritative. CDDL describes the data model; `spec/30-serialization.md` defines how that data model is encoded canonically on the wire.

## Conventions

* Map keys are unsigned integers, matching the field tables in `spec/`.
* `N => type` entries in a map are keyed by the integer `N`.
* `time` is a uint epoch-seconds value (no CBOR tag), per `spec/31-wire-types.md` section 31.7.
* Byte-string lengths are enforced with `.size`.
* Identifier lengths match `spec/10-identifiers.md` section 10.1.
* Protocol version strings are `"0.1"`.
* The files share one namespace and are intended to be combined before validation. Each named type is defined once across the directory.

## Deterministic CBOR

CDDL does not enforce canonical ordering, preferred integer lengths, or the absence of tags and duplicates. The normative rules are `spec/30-serialization.md`. For a given protocol object there is exactly one valid canonical byte encoding. CDDL validates the decoded data model; canonical-encoding checks are separate and MUST also be applied, per `spec/31-wire-types.md` section 31.9.

## Negative structures

The schemas define valid structures only. Negative test cases (wrong lengths, duplicate keys, non-canonical encodings, wrong types) are described in `spec/82-limits-and-validation.md` and the test-vector plan in `test-vectors/`.

## Files

| File | Structures covered |
| ---- | ------------------ |
| `common.cddl` | Shared primitive types and constants. |
| `identifiers.cddl` | Identifier byte strings. |
| `crypto.cddl` | Public keys, signatures, nonces. |
| `devices.cddl` | Device authorization records and device summaries. |
| `events.cddl` | Event envelope, object reference, all event bodies. |
| `objects.cddl` | Object envelope, recipient records, object AAD map. |
| `content.cddl` | Post, reply, direct message, relationship, notification, media, membership, group metadata content. |
| `instances.cddl` | Instance document and operational keys. |
| `accounts.cddl` | Account lookup response. |
| `federation.cddl` | Federation endpoint request and response bodies, sync pages. |
| `errors.cddl` | Error object. |