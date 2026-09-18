# 0008: Test vectors staged behind the wire format

* Status: accepted
* Basis: `test-vectors/README.md`, `test-vectors/generate.mjs`, `decisions/0011`, `decisions/0012`, `decisions/0013`

## Context

Test vectors for signatures and encryption require freezing every byte of the wire format and key material, which was premature while `decisions/0004` and `0009` were still open. Separately, the three blocking constructions in `decisions/0011` to `0013` changed bytes that had no vectors at all, leaving their behaviour unverifiable.

## Alternatives

1. Generate and commit vectors for the whole protocol now. Rejected: they would churn with the parts of the wire format that are still open and mislead readers into treating unstable bytes as normative.
2. Commit only a coverage plan. Rejected: the three fixed constructions need byte-exact vectors to be reproducible, because a one-byte ambiguity in them is a security or interoperability defect.
3. Commit vectors for the three frozen constructions now and keep the full coverage plan for the rest. Chosen.

## Decision

`test-vectors/` contains byte-exact vectors for first-device authorization, HPKE object-key wrapping, and versioned-object AAD, plus a reproducible generator (`test-vectors/generate.mjs`). The remaining vectors in the coverage plan are generated as the wire format freezes, before 1.0. `0004` and `0009` have since resolved, and their vectors are committed (`test-vectors/relationship-events.json`, `test-vectors/username-grammar.json`).

## Consequences

* The three blocking constructions are reproducible and independently checkable.
* The generator's HPKE implementation is validated against RFC 9180 A.1 (KEM shared secret and key schedule).
* The rest of the coverage plan (MLS credential binding, `spec/25-mls.md`) remains a contract on the critical path for 1.0.
* Until full vectors exist, broader conformance claims still rest on schema and example review, not automated cross-implementation checks.