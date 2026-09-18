# 13. Instances

This module defines instances, instance identity, instance operational keys, transport, membership, and account lookup.

## 13.1 Instance

An instance is a network service implementing the Loopable server-side protocol. An instance has its own permanent cryptographic identity, independent of all account identities.

An instance provides network connectivity, federation, membership management, encrypted object storage (typically an S3-compatible object store, per `65-object-storage.md`), synchronization, local moderation, rate limiting, resource management, account hosting, and protocol endpoints.

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
| 4 | `domain` | text | yes | Canonical hostname the instance is on, per `13.4`. |
| 5 | `administrator` | bytes(32) | yes | The administrator account_id (the instance owner), per `13.10`. |
| 6 | `description` | text | no | Human-readable instance description. |
| 7 | `rules` | array&lt;text&gt; | no | Instance rules, as a flat list of rule strings. |
| 8 | `signature` | bytes(64) | yes | Root signature, per `61-federation-authentication.md`. |

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
"loopable-instance-document-v1" 0x00 || deterministic_cbor(instance document without key 8)
```

### 13.3.4 Operational-key transitions

Rotating or revoking operational keys, or changing instance metadata such as the description or rules, produces a new instance document signed by the root. The `instance_id` and `root_public_key` never change across transitions, and the `administrator` never changes. A revoked operational key is removed from the array; a rotated key is added with a new `key_id`.

A compromised operational key does not require changing the instance's permanent identity. Federation peers MUST accept a new valid instance document, MUST reject a document whose signature fails, and MUST treat a document containing no currently-valid (by time) operational key as invalid for request authentication, per `61-federation-authentication.md`.

## 13.4 Hostname canonicalization

An instance has a canonical hostname. Canonicalization MUST:

1. Lowercase the hostname.
2. Remove a single trailing dot, if present.
3. Convert a Unicode name to its IDNA A-label form.
4. Remove any port, scheme, or path. The hostname is name-only.

The full Unicode domain name is NOT part of the canonical form; the A-label is. Implementations MUST use canonical hostnames in handles (`11.5`), in federation routing (`60-federation.md`), and in account lookup. The canonical hostname is published in the instance document as `domain` (`13.3.1`) and is what "what instance is it" resolves to in `13.10`.

## 13.5 Membership

Instance membership is separate from following, friendship, group membership, profile visibility, and object audience.

Joining an instance grants the member the ability to interact with members and resources that the instance exposes according to the protocol and local policy. Membership does not automatically grant decryption access to every object associated with every member, per `33-object-envelope.md`.

An instance MAY restrict membership (invitation, approval, organizational membership, another locally defined condition). A private instance does not imply plaintext storage.

Membership state required for protocol operation, such as whether an account is hosted locally or present as a federated account, MAY be stored by the instance. Memberships are represented as authenticated events where the protocol requires agreement between participants, per `53-contexts-and-membership.md` and `34-event-types.md`.

## 13.6 Account lookup

A member of an instance MAY perform a direct account lookup for an account hosted or present in that instance. A client of any instance MAY perform a direct account lookup for an account that has a public profile (`51.5`), with no membership requirement. For any other account, the requester MUST be a member of the receiving instance; the instance MUST treat a non-member as if the account does not exist, per `91-privacy.md`.

A lookup MAY return:

* canonical handle;
* `account_id`;
* account identity public key;
* cryptographic identity metadata (device authorization summary bounded per `82-limits-and-validation.md`);
* relevant membership state;
* `profile_is_public`;
* for a public account, the public profile card defined in `51.5`;
* local staff roles of the account on this instance (`13.10`);
* the `blocked` marker when the requester has blocked the target account (`50.5`). When it is returned, the lookup MUST NOT return any other account data.

A lookup MUST NOT return:

* private keys;
* device private keys;
* complete device history;
* unauthorized encrypted objects;
* unauthorized social relationships.

Protocol details of the lookup endpoint are in `60-federation.md`.

## 13.7 No enumeration

Instance membership grants lookup capability. It does not require the instance to expose a complete member directory.

A public profile (`51.5`) makes an account individually lookupable. It does not grant the right to enumerate the instance or to build a directory.

Implementations SHOULD prevent trivial bulk enumeration of every account. Rate limiting MAY be used. Local instance policy MAY impose additional restrictions.

## 13.8 Transport

Federation and client traffic MUST use HTTPS.

* TLS 1.3 MUST be supported.
* TLS 1.2 MAY be supported for compatibility only where a future compatibility profile explicitly permits it.
* New deployments SHOULD require TLS 1.3.

Application-level Loopable signatures remain mandatory even when TLS is used. TLS authenticates the transport endpoint; Loopable signatures authenticate protocol entities. An implementation MUST NOT treat TLS certificate ownership as equivalent to Loopable instance identity. TLS certificates and TLS keys are separate from Loopable instance identity keys, per `21-key-management.md`.

## 13.9 Instance discovery

Instance discovery is not part of the Loopable Protocol. It is an optional service, defined in `70-instance-discovery.md`. Instances are unlisted by default and a discovery service is not a trust root.

## 13.10 Instance roles and moderation

Each instance has two staff roles in addition to regular membership: `moderator` and `administrator`. Both are per-instance: holding a staff role on one instance confers no authority on any other instance, and being staff on instance A does not imply the same roles on instance B unless B configures them separately.

### 13.10.1 Administrator

* The administrator is the instance owner: the account that set up the instance.
* There is exactly one administrator, recorded in the instance document (`administrator`, `13.3.1`) and publicly available.
* The administrator role cannot be transferred. The administrator is not also a moderator: it has full moderator authority and additionally appoints and demotes moderators.
* If the administrator account is deleted (`40.4`), the operator must reconfigure the instance out of band. The protocol defines no automatic succession.

### 13.10.2 Moderators

* Moderators are appointed and demoted by the administrator only.
* A moderator cannot appoint or demote other moderators, cannot demote the administrator, and cannot change its own role.
* The instance publishes its current moderator list through the roles endpoint (`13.10.4`).

### 13.10.3 Moderation powers

A moderator (and therefore the administrator) may:

* **ban** an account: remove it from instance membership and prevent it from joining or registering again. The instance MUST reject further membership attempts for a banned account with `E_BANNED` (`80-errors.md`).
* **kick** an account: remove it from instance membership. Kicking does not prevent rejoining; the account MAY rejoin subject to instance policy.
* **mute** an account: keep it in the instance but restrict it to read-only access. A muted account MAY view content in the instance but MUST NOT create posts, replies, or messages within the instance's scope, and MUST NOT otherwise engage with content in the instance.
* **suspend** an account: keep its membership but deny all access for a bounded interval. A suspended account MUST NOT read or write within the instance until the interval ends; the instance releases the suspension automatically when the interval expires. A suspension interval MUST be finite and MUST NOT exceed 365 days (`82.1`). The instance SHOULD notify the suspended account of the interval and the moderator action that started it.

Moderation is instance-local enforcement applied to membership (`13.5`, `53.2`) and to what the instance serves and relays (`60.7`, `91-privacy.md`). It is part of the instance's local policy and does not change the cryptography of events or objects. Staff roles never grant plaintext decryption access.

### 13.10.4 Roles endpoint

`GET /v1/instance/roles` is public and returns:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `administrator` | bytes(32) | yes | The administrator account_id. |
| 1 | `moderators` | array&lt;bytes(32)&gt; | yes | Current moderator account_ids. |

An instance SHOULD disclose a member's local staff role in account lookup responses (`60.8`) so clients can render "moderator/administrator of `<domain>`" for each instance that publishes that role.