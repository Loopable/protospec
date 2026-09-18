# 13. Instances

This module defines instances, instance identity, instance operational keys, transport, membership, and account lookup.

## 13.1 Instance

An instance is a network service implementing the Loopable server-side protocol. An instance has its own permanent cryptographic identity, independent of all account identities.

An instance provides network connectivity, federation, membership management, encrypted object storage, synchronization, local moderation, rate limiting, resource management, account hosting, and protocol endpoints.

## 13.2 Instance identity

The instance root identity uses Ed25519. The instance identifier is derived from the root public key per `10-identifiers.md` (section `10.5`):

The `instance_id` wire form is `SHA-256("loopable-instance-id" 0x00 || root_public_key)`.

The instance identity MUST remain stable across operational-key rotation and across changes to TLS certificates, domain rotation, or hosting. It is the persistent cryptographic identity of the instance.

## 13.3 Operational keys

The instance root key is the long-term identity key. It SHOULD be kept offline or otherwise strongly protected.

The root key authorizes one or more operational federation keys. Operational keys:

1. MAY rotate.
2. MAY be revoked.
3. SHOULD have an explicitly bounded lifetime.
4. MUST be cryptographically linked to the instance root.

The mapping from the root key to current operational keys is the instance document.

### 13.3.1 Instance document

An instance document is a signed structure that publishes the instance's root identity and its current operational keys. It has the following CBOR map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `protocol_version` | text | yes | Protocol version `"0.1"`. |
| 1 | `instance_id` | bytes(32) | yes | Derived per `10.5`; MUST match the root public key. |
| 2 | `root_public_key` | bytes(32) | yes | The instance root Ed25519 public key. |
| 3 | `operational_keys` | array&lt;instance_op_key&gt; | yes | Currently authorized operational keys; at least one. |
| 4 | `signature` | bytes(64) | yes | Root signature, per `61-federation-authentication.md`. |

### 13.3.2 instance_op_key

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `key_id` | bytes(16) | yes | First 16 bytes of SHA-256 of the operational public key. |
| 1 | `public_key` | bytes(32) | yes | The operational Ed25519 public key. |
| 2 | `not_before` | time | yes | Earliest valid use time. |
| 3 | `not_after` | time | yes | Latest valid use time. |

### 13.3.3 Instance document signature

The instance document signature is Ed25519 over:

```text
"loopable-instance-document-v1" 0x00 || deterministic_cbor(instance document without key 4)
```

### 13.3.4 Operational-key transitions

Rotating or revoking operational keys produces a new instance document with a new `operational_keys` array, signed by the root. The `instance_id` and `root_public_key` never change across transitions. A revoked operational key is removed from the array; a rotated key is added with a new `key_id`.

A compromised operational key does not require changing the instance's permanent identity. Federation peers MUST accept a new valid instance document, MUST reject a document whose signature fails, and MUST treat a document containing no currently-valid (by time) operational key as invalid for request authentication, per `61-federation-authentication.md`.

## 13.4 Hostname canonicalization

An instance has a canonical hostname. Canonicalization MUST:

1. Lowercase the hostname.
2. Remove a single trailing dot, if present.
3. Convert a Unicode name to its IDNA A-label form.
4. Remove any port, scheme, or path. The hostname is name-only.

The full Unicode domain name is NOT part of the canonical form; the A-label is. Implementations MUST use canonical hostnames in handles (`11.5`), in federation routing (`60-federation.md`), and in account lookup.

## 13.5 Membership

Instance membership is separate from following, friendship, group membership, profile visibility, and object audience.

Joining an instance grants the member the ability to interact with members and resources that the instance exposes according to the protocol and local policy. Membership does not automatically grant decryption access to every object associated with every member, per `33-object-envelope.md`.

An instance MAY restrict membership (invitation, approval, organizational membership, another locally defined condition). A private instance does not imply plaintext storage.

Membership state required for protocol operation, such as whether an account is hosted locally or present as a federated account, MAY be stored by the instance. Memberships are represented as authenticated events where the protocol requires agreement between participants, per `53-contexts-and-membership.md` and `34-event-types.md`.

## 13.6 Account lookup

A member of an instance MAY perform a direct account lookup for an account hosted or present in that instance.

A lookup MAY return:

* canonical handle;
* `account_id`;
* account identity public key;
* cryptographic identity metadata (device authorization summary bounded per `82-limits-and-validation.md`);
* relevant membership state.

A lookup MUST NOT return:

* private keys;
* device private keys;
* complete device history;
* unauthorized encrypted objects;
* unauthorized social relationships.

Protocol details of the lookup endpoint are in `60-federation.md`.

## 13.7 No enumeration

Instance membership grants lookup capability. It does not require the instance to expose a complete member directory.

Implementations SHOULD prevent trivial bulk enumeration of every account. Rate limiting MAY be used. Local instance policy MAY impose additional restrictions.

## 13.8 Transport

Federation and client traffic MUST use HTTPS.

* TLS 1.3 MUST be supported.
* TLS 1.2 MAY be supported for compatibility only where a future compatibility profile explicitly permits it.
* New deployments SHOULD require TLS 1.3.

Application-level Loopable signatures remain mandatory even when TLS is used. TLS authenticates the transport endpoint; Loopable signatures authenticate protocol entities. An implementation MUST NOT treat TLS certificate ownership as equivalent to Loopable instance identity. TLS certificates and TLS keys are separate from Loopable instance identity keys, per `21-key-management.md`.

## 13.9 Instance discovery

Instance discovery is not part of the Loopable Protocol. It is an optional service, defined in `70-instance-discovery.md`. Instances are unlisted by default and a discovery service is not a trust root.