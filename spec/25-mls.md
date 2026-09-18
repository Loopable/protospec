# 25. MLS

This module is the authoritative definition of how Messaging Layer Security groups are integrated into Loopable.

## 25.1 Scope

Dynamic multi-party encrypted groups MUST use MLS, RFC 9420, with the mandatory MLS 1.0 cipher suite, per `20.9`. Loopable MUST NOT define a proprietary group key-management protocol. This module defines how MLS state is associated with Loopable accounts, devices, groups, and events. The cryptographic internals remain governed by RFC 9420.

## 25.2 Cipher suite

The mandatory MLS suite is `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`. An MLS group MUST use this suite. The encrypted content of an MLS message is the group's shared protection; ordinary Loopable object encryption (AES-256-GCM per `23-encryption.md`) applies to non-group objects. MLS's internal AES-128-GCM MUST NOT be used for ordinary Loopable object encryption.

## 25.3 Identity binding

An MLS leaf MUST be cryptographically associated with the relevant Loopable device identity. The MLS credential MUST contain enough information to bind the participant to the account identity, the device identity, and the device signing key, and the binding MUST be independently verifiable. An instance MUST NOT be able to substitute a different user's MLS identity.

The Loopable MLS credential is a custom MLS credential, per RFC 9420 section 5.3, whose credential_data is the canonical CBOR map:

| Key | Field | Type | Description |
| --- | ----- | ---- | ----------- |
| 0 | `credential_type` | uint | Always `0`, identifying a Loopable device credential. |
| 1 | `account_id` | bytes(32) | The Loopable account identifier. |
| 2 | `device_id` | bytes(16) | The Loopable device identifier. |
| 3 | `device_signing_public_key` | bytes(32) | The device's Ed25519 public key. |
| 4 | `account_identity_public_key` | bytes(32) | The account's identity Ed25519 public key. |

The signing key of the MLS signature scheme is the device's Ed25519 key: signatures produced inside MLS are validated against `device_signing_public_key`.

The Loopable credential binding label `loopable-mls-credential-v1` `0x00` (registered in `20.12`) MUST be included as the first 32 bytes of the credential identity when a credential type is presented outside HTTPS negotiation. The MAC value of the credential is computed by the MLS-library-defined process; implementations MUST reject a conclusion that a credential belongs to one account when its `account_id`-to-`account_identity_public_key` binding does not validate, and MUST verify that the derived `account_id` from `account_identity_public_key` per `10.5` matches field 1.

## 25.4 Group state and events

The MLS group state is authoritative for cryptographic group membership. The Loopable social layer determines whether a user is eligible to request membership, and the instance MAY enforce local membership policy, but the instance MUST NOT forge an MLS membership change.

Group membership changes MUST be represented by authenticated Loopable events. The event types `GROUP_CREATED`, `GROUP_DELETED`, `GROUP_MEMBER_ADDED`, `GROUP_MEMBER_REMOVED`, `GROUP_JOINED`, `GROUP_LEFT`, and `GROUP_UPDATED` are defined in `34-event-types.md`. Each group event RECOMMENDED to carry the MLS `group_id` and the current epoch number so that independent implementations can align cryptographic group state with social state.

## 25.5 MLS messages on the wire

MLS control messages (KeyPackage, Welcome, GroupInfo, Commit, Proposal, and application PrivateMessage) are carried as opaque encrypted objects on the Loopable transport, per `33-object-envelope.md`, using `recipient_kind = 1` records where the group record is defined in `25.6`. The object type `MLS_MESSAGE` (`34-event-types.md`) identifies a bare MLS message.

The Loopable event graph provides the causal chain for MLS messages so a receiving instance can order them and request missing predecessors per `63-event-dependencies.md`. A group's MLS state progresses forwards only when its `group_id` and epoch numbers advance consistently.

## 25.6 MLS recipient key record

For `recipient_kind = 1`, the recipient key record per `24.6` is:

| Key | Field | Type | Description |
| --- | ----- | ---- | ----------- |
| 0 | `recipient_kind` | uint | `1`. |
| 1 | `account_id` | bytes(0) | Empty. |
| 2 | `device_id` | bytes(0) | Empty. |
| 3 | `recipient_key_id` | bytes(16) | First 16 bytes of the MLS `group_id`, per `24.4`. |
| 4 | `encapsulated_key` | bytes(0) | Empty; the group key is derived through MLS. |
| 5 | `wrapped_key` | bytes(0) | Empty; no per-object wrapping applies. |

## 25.7 Forward secrecy and post-compromise security

For MLS-protected groups, forward secrecy and post-compromise security MUST be provided according to the guarantees of RFC 9420. Ordinary per-object encryption does not provide those properties, and implementations MUST NOT advertise stronger guarantees than the construction provides.

## 25.8 Group lifecycle

* Creation: `GROUP_CREATED` event plus the MLS commit that initializes the group.
* Joining: eligible accounts request membership through the social layer; a group member adds them via `GROUP_MEMBER_ADDED` and an MLS commit.
* Leaving: `GROUP_LEFT` event plus an MLS remove.
* Removal: `GROUP_MEMBER_REMOVED` event plus an MLS remove.
* Deletion: `GROUP_DELETED` event. After the deletion event becomes authoritative, clients MUST stop treating the group as active. Previously encrypted ciphertext may remain physically present on infrastructure; physical deletion and cryptographic inaccessibility are separate concerns, per `65-object-storage.md` and `90-security.md`.

The group lifecycle is elaborated in `53-contexts-and-membership.md`.