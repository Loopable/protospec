# 0010: Integer-keyed registries instead of free-form string types

* Status: accepted
* Basis: `spec/34-event-types.md`, `spec/33-object-envelope.md` 33.7, `spec/80-errors.md`, `spec/81-versioning-and-capabilities.md`

## Context

The draft describes event kinds and object types loosely, leaving type names as implementation-defined strings.

## Alternatives

1. Free-form type strings. Rejected: federation would need to settle a vocabulary, and unknown types are ambiguous.
2. Integer codes with a registry. Chosen.

## Decision

Event types, object types, error codes, device kinds, and capabilities are integer or enumerated codes with normative registries in the spec and CDDL. Unknown codes are rejected per `spec/82-limits-and-validation.md` except where the spec explicitly permits forward-compatible handling (`spec/81-versioning-and-capabilities.md` 81.4). `E_MANDATORY_UNKNOWN` covers a mandatory capability the implementation cannot honor.

## Consequences

* Decoders can fast-path dispatch and fail loudly on unknown types instead of guessing.
* Version negotiation is explicit rather than ordinal.
* Registries must be extended by the process in `spec/101-implementation-requirements.md` 101.4, not ad hoc.