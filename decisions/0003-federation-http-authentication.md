# 0003: Instance-to-instance HTTP signature authentication

* Status: accepted
* Basis: `spec/61-federation-authentication.md`

## Context

Federation carries signed events, but instance-to-instance HTTP requests need an authentication envelope so instances cannot impersonate one another to third parties, and requests can be replayed safely against.

## Alternatives

1. Rely on mutual TLS alone. Rejected: no path for other instances to validate a request's provenance cryptographically, and HTTP JSON endpoints remain.
2. Bearer tokens exchanged out of band. Rejected: adds a key-distribution protocol with no wire form here.
3. An HTTP signature scheme over a domain-separated reconstruction of the request. Chosen.

## Decision

Every instance request carries `Authorization: Loopable v=1;instance=...;key=...;request=...;ts=...;sig=...`. The signature is Ed25519 by the sending instance op key over the canonical request signature input (`spec/61-federation-authentication.md` 61.4). Requests authenticate device records through the account, not vice versa.

## Consequences

* Requests become replay-resistant within a 300-second window and uniquely attributable.
* The header text form is deliberately restricted: no extra parameters beyond the six mandatory ones, to keep parsing trivial and injection-free.
* Stateless responses are not signed; the reply carries events. State-changing responses therefore always arrive as signed events.