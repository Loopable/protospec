# Design decisions

This directory records the deliberately chosen protocol design points. `spec/` resolves ambiguities; these files say why.

## How decisions are recorded

Each decision is a numbered file with:

* status: `accepted`, `proposed`, `rejected`, `deprecated`, `superseded`;
* basis: the section it resolves in `spec/`;
* alternatives considered;
* the choice;
* consequences;
* whether it originates a deviation from the foundational draft.

A `blocking` decision is a foundational contradiction that the specification could not resolve without choosing one side. These are marked `status: blocking` and MUST be revisited by the working group before 1.0.

## Index

| # | Decision | Status |
| - | -------- | ------ |
| 0001 | Domain-stamped identifiers and ID derivation | accepted |
| 0002 | Deterministic CBOR as the only wire serialization | accepted |
| 0003 | Instance-to-instance HTTP signature authentication | accepted |
| 0004 | The social graph is signed events; encrypted relationship objects are private metadata to authorized followers | blocking |
| 0005 | Synchronization without "round-trip simulation" | accepted |
| 0006 | Instance documents and time-bound operational keys | accepted |
| 0007 | MLS 1.0 for group messaging | accepted |
| 0008 | Test vectors staged behind the wire format | accepted |
| 0009 | Username and deletion reservation windows | blocking |
| 0010 | Integer-keyed registries instead of free-form string types | accepted |
| 0011 | First-device authorization is a signed record in ACCOUNT_CREATED | accepted |
| 0012 | HPKE recipient identifiers must be acyclic | accepted |
| 0013 | Object AAD binds the object version | accepted |
| 0014 | Object version_id is required in protocol version 0.1 | accepted |