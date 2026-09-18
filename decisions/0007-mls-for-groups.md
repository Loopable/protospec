# 0007: MLS 1.0 for group messaging

* Status: accepted
* Basis: `spec/25-mls.md`, `spec/53-contexts-and-membership.md`

## Context

Group messaging generalizes the pairwise key relationships of the account model. A naive mesh of HPKE recipient records weakens forward secrecy, complicates member changes, and gives each group member its own copy of state.

## Alternatives

1. HPKE fan-out to every member on every message. Rejected: no forward secrecy between removals; the entire member list is a recipient gate; member changes require re-encrypting past content.
2. A custom group-key protocol. Rejected: reinventing MLS is worse than using MLS.
3. MLS 1.0 (RFC 9420) bound to the account movement. Chosen.

## Decision

Group state is an MLS epoch. MLS messages travel as encrypted `mls_message` objects with the domain-separated `loopable-mls-credential-v1` label; group membership moves are *also* account events (`GROUP_MEMBER_ADDED`, `GROUP_MEMBER_REMOVED`, `GROUP_JOINED`, `GROUP_LEFT`, `GROUP_UPDATED`) so the event graph and the epoch are consistent (`spec/25-mls.md` 25.4, `spec/34-event-types.md` 34.11).

## Consequences

* Groups get forward secrecy and post-compromise security from MLS.
* The protocol depends on an MLS implementation; the minimum suite is fixed to one mandatory suite (`spec/20-cryptographic-primitives.md` 20.2).
* Epoch/event consistency must be validated on ingest, and missing epochs are recoverable through the event DAG.