# 0006: Instance documents and time-bound operational keys

* Status: accepted
* Basis: `spec/13-instances.md`

## Context

The draft gives each instance a single static key pair used for everything. That couples key rotation to instance identity and makes a single compromise long-lived.

## Alternatives

1. Single static instance key pair. Rejected: rotation is destructive and revocation is binary.
2. Two long-lived keys (root + signing). Chosen.

## Decision

Each instance publishes an instance document binding its root key to time-bound operational keys (`spec/13-instances.md` 13.3). Requests are signed with an operational key inside its validity window; the root signs the document and is used only for the document and federation trust (`spec/61-federation-authentication.md` 61.5).

## Consequences

* Key rotation no longer changes the instance ID.
* A compromise of an operational key is time-bounded.
* The root key's compromise remains catastrophic but is detectable via key-history validation.