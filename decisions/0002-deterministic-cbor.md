# 0002: Deterministic CBOR as the only wire serialization

* Status: accepted
* Basis: `spec/30-serialization.md`, `spec/31-wire-types.md`

## Context

The draft's flexible wire format leaves serialization to implementations, which breaks signature verification across implementations.

## Alternatives

1. JSON with stable stringification. Rejected: no canonical byte form; order, whitespace, and number representation are implementation-defined.
2. CBOR general-purpose encoding. Rejected: multiple valid bytes for the same data model. Signature domains would not be deterministic.
3. Deterministic (canonical) CBOR. Chosen.

## Decision

One canonical byte encoding per logical protocol object, defined exhaustively in `spec/30-serialization.md`. Map keys are the unsigned integers of the field tables in `spec/32-event-envelope.md` etc. Deviations (non-preferred integer lengths, non-minimal encodings, duplicate keys, extras, tags) are rejected per `spec/82-limits-and-validation.md` 82.3.

## Consequences

* Implementers can interoperate without a shared serialization library.
* Signature input, HPKE info strings, and object AAD are all computed from the same canonical bytes.
* A validator must enforce canonical encoding, not merely parse CBOR.