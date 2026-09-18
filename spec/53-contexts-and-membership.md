# 53. Contexts and membership

This module defines contexts, instance membership, and group membership as distinct authorization concepts.

## 53.1 Contexts

A context is a protocol-defined scope in which accounts interact and encrypted data may be made available. A context MAY represent an instance-wide social space, a private social space, a group, or another protocol-defined audience.

Context membership MUST NOT be conflated with instance membership. An account may be a member of an instance without being a member of a particular private group.

The audience of an object is a cryptographic concept (`33-object-envelope.md`); a context is a social concept. Following is not a context and is not an authorization model.

## 53.2 Instance membership

Instance membership grants the member the ability to interact with members and resources that the instance exposes according to the protocol and the instance's local policy.

Instance membership does not automatically grant decryption access to every object associated with every member. Decryption access is determined by recipient records and MLS group state.

An instance MAY restrict membership by invitation, administrator approval, organizational membership, or another locally defined eligibility condition. A private instance does not imply plaintext storage. Local membership policy is defined by the instance operator and is not part of the crypto protocol.

## 53.3 Group contexts

A group is a dynamic multi-party context whose cryptography is MLS (`25-mls.md`). Group membership has two layers:

1. A social layer: the Loopable `member` relationship expressed by group events.
2. A cryptographic layer: the MLS group state, which is authoritative for cryptographic membership.

These layers MUST be kept aligned: a `GROUP_MEMBER_REMOVED` event MUST be accompanied by an MLS remove commit that excludes the member, and a `GROUP_JOINED` event MUST be accompanied by the joining device obtaining a Welcome. The instance MAY enforce local membership policy but MUST NOT forge an MLS membership change.

## 53.4 Group lifecycle

The lifecycle is driven by the group events of `34.11`:

1. Create: `GROUP_CREATED` (auth `AUTHORIZED`), plus the MLS commit that initializes the group.
2. Join: a non-member requests membership through the social layer; a current member adds the device or account via `GROUP_MEMBER_ADDED` and an MLS add.
3. Leave: `GROUP_LEFT`.
4. Remove: `GROUP_MEMBER_REMOVED` and an MLS remove.
5. Update: `GROUP_UPDATED` for epoch advancement.
6. Close: `GROUP_DELETED`. Clients MUST stop treating the group as active after the `GROUP_DELETED` event becomes authoritative.

Physical deletion and cryptographic inaccessibility are separate concerns, per `65-object-storage.md` and `90-security.md`.

## 53.5 Membership object

A `membership` object (object type 6) MAY accompany a group event to carry encrypted, per-member annotations. It is not a source of graph truth; the group events and MLS state are. Its content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `member_account_id` | bytes(32) | yes | The subject account. |
| 1 | `role` | uint | no | `0` regular, `1` owner. |

## 53.6 Group metadata object

A `group_metadata` object (object type 7) carries the encrypted display name of a group, referenced from `GROUP_CREATED`. It is not a source of graph truth; the group events and MLS state are. Its content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `name` | text | yes | The group display name. |

## 53.7 Context authorization

An object whose audience is "a context" MUST be encrypted (always) and its recipient records MUST target the devices of current context members. For dynamic groups the recipient set is the MLS group (`25.6`). For non-MLS contexts the recipient set is the explicit device set the object references. A context change that alters the membership MUST cause re-encryption under a new envelope and, where required, a new object version, per `55-content.md`.