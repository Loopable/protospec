# Loopable Protocol examples

These files show complete protocol exchanges at the wire level. Identifiers and key material are illustrative only.

## Structure

| File | Exchange shown |
| ---- | -------------- |
| `account-and-post.md` | Account creation, device authorization, post creation with encryption, submission. |
| `device-authorization.md` | Trusted-device sync and device authorization, then device revocation. |
| `federation-request.md` | A signed instance-to-instance HTTP request and its authentication header. |
| `sync-session.md` | A cursor-based synchronization session between two instances. |
| `username-change.md` | Username change and reservation timing. |
| `group-join.md` | Group creation, join, and MLS epoch advance. |
| `error-examples.md` | Canonical error responses for common rejections. |

## Invariants

Every example follows:

* deterministic CBOR per `spec/30-serialization.md`;
* canonical base32lower identifier text per `spec/10-identifiers.md`;
* the event and object envelope key tables of `spec/32-event-envelope.md` and `spec/33-object-envelope.md`;
* signature domains of `spec/22-signatures.md`;
* the authentication header format of `spec/61-federation-authentication.md`;
* the endpoints of `spec/60-federation.md`.

Signatures shown as `sig( ... )` are placeholders in the signature domain of the referenced label; see the federation-request example for a real construction outline.