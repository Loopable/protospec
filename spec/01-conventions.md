# 01. Conventions

## 1.1 Normative language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and **OPTIONAL** in this specification are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

## 1.2 Document status

This specification is version 0.1 of the Loopable Protocol. The protocol versioning rules are defined in `81-versioning-and-capabilities.md`.

## 1.3 Layers

The specification distinguishes three layers:

1. Abstract protocol semantics: the meaning of a concept and its invariants. This layer does not depend on a specific encoding.
2. Wire representation: the exact CBOR encoding, field numbers, types, and lengths.
3. Transport behavior: HTTP endpoints, authentication, and synchronization exchange rules.

A module states which layer each requirement applies to. Requirements that refer to both are possible; for example an event field has abstract semantics and a wire encoding.

## 1.4 Authoritative definitions

Every protocol concept has exactly one authoritative normative home. A module that needs a concept defined elsewhere MUST reference that definition and MUST NOT redefine it. This rule applies to:

* Cryptographic algorithms: `20-cryptographic-primitives.md`.
* Key material and key lifecycle: `21-key-management.md`.
* Serialization: `30-serialization.md`.
* Wire data types: `31-wire-types.md`.
* Identifiers: `10-identifiers.md`.
* Event envelope: `32-event-envelope.md`.
* Object envelope: `33-object-envelope.md`.
* Event type registry: `34-event-types.md`.
* Federation transport: `60-federation.md`.

## 1.5 Notation

### 1.5.1 Byte strings

Byte strings are written as hex, lowercase, with a leading `0x`, separated by spaces every byte or every group of bytes for readability. The canonical form is the raw byte sequence.

Example:

```text
0x48 65 6c 6c 6f
```

### 1.5.2 Text strings

Text strings are written between double quotes. All protocol text strings are UTF-8.

### 1.5.3 CBOR

CBOR values are shown as CDDL snippets from `schemas/` or as annotated CBOR diagnostic notation. Deterministic CBOR rules are defined in `30-serialization.md`.

### 1.5.4 Field tables

Every wire structure has a field table with the following columns:

* Key: the CBOR map key (an unsigned integer).
* Field: the canonical field name.
* Type: the wire type per `31-wire-types.md`.
* Required: whether the field MUST be present.
* Description: semantics and constraints.

## 1.6 Absence and default values

A field that is not required MUST be omitted from the encoded map when it has no value. There is no concept of an implicit default for an omitted field unless the field table or the defining module states one. An encoder MUST NOT emit a field with a null or empty "default" value when the field is defined as optional.

## 1.7 Ordering and canonical encoding

All map keys on the wire are unsigned integers. Canonical encoding order is defined in `30-serialization.md` and does not depend on field table order. The field tables in this specification list keys in ascending numeric order for readability.

## 1.8 Examples

Examples in this specification are informative and do not override normative text. Complete worked exchanges live in `examples/`.

## 1.9 Assigning new codes and types

New event types, object types, error codes, capabilities, and other registries belong to the corresponding normative registry. A proposal that adds a registry entry MUST follow the extension process in `101-implementation-requirements.md`.

## 1.10 Requirements on implementations

A statement that applies to "an implementation" applies to both client-side and server-side behavior unless the module states otherwise. A statement that applies to "an instance" applies to server-side behavior. A statement that applies to "a client" applies to client-side behavior.