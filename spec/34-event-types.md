# 34. Event types

This module is the authoritative event type registry. Each entry defines the body schema, the authorization requirement, and the lifecycle semantics of the event.

## 34.1 Authorization levels

| Level | Meaning |
| ----- | ------- |
| `GENESIS` | Signed by the account identity key directly. Only `ACCOUNT_CREATED` uses this. |
| `TRUSTED` | Signed by the account's currently trusted device. |
| `AUTHORIZED` | Signed by any device currently authorized for the account. |
| `MEMBER` | Signed by any currently authorized device of an account that is a current member of the group, for group-scoped events. |

The trusted device resolution rules are defined in `42-identity-and-authorization.md`.

## 34.2 Registry

| Code | Event type | Auth | Purpose |
| ---- | ---------- | ---- | ------- |
| 0 | `ACCOUNT_CREATED` | GENESIS | Create the account and authorize its first device. |
| 1 | `DEVICE_AUTHORIZED` | TRUSTED | Authorize a new device. |
| 2 | `DEVICE_REVOKED` | TRUSTED | Revoke a device. |
| 3 | `TRUSTED_DEVICE_TRANSFERRED` | TRUSTED | Transfer trusted-device status. |
| 4 | `USERNAME_CHANGED` | TRUSTED | Change the account username. |
| 5 | `ACCOUNT_DELETED` | TRUSTED | Delete the account. |
| 6 | `FOLLOW_CREATED` | AUTHORIZED | Begin following an account. |
| 7 | `FOLLOW_REMOVED` | AUTHORIZED | Stop following an account. |
| 8 | `BLOCK_CREATED` | AUTHORIZED | Block an account. |
| 9 | `BLOCK_REMOVED` | AUTHORIZED | Unblock an account. |
| 10 | `MUTE_CREATED` | AUTHORIZED | Mute an account. |
| 11 | `MUTE_REMOVED` | AUTHORIZED | Unmute an account. |
| 12 | `PROFILE_UPDATED` | AUTHORIZED | Publish a new profile version. |
| 13 | `POST_CREATED` | AUTHORIZED | Publish a new post version. |
| 14 | `POST_EDITED` | AUTHORIZED | Publish a new post version replacing one. |
| 15 | `POST_DELETED` | AUTHORIZED | Delete a post. |
| 16 | `REPLY_CREATED` | AUTHORIZED | Publish a reply. |
| 17 | `GROUP_CREATED` | AUTHORIZED | Create a group. |
| 18 | `GROUP_DELETED` | MEMBER | Delete a group. |
| 19 | `GROUP_MEMBER_ADDED` | MEMBER | Add a member. |
| 20 | `GROUP_MEMBER_REMOVED` | MEMBER | Remove a member. |
| 21 | `GROUP_JOINED` | AUTHORIZED | Accept membership as the joining subject. |
| 22 | `GROUP_LEFT` | MEMBER | Leave a group as the leaving subject. |
| 23 | `GROUP_UPDATED` | MEMBER | Advance MLS epoch or update group state. |
| 24 | `MESSAGE_CREATED` | AUTHORIZED | Publish a direct message object. |

All registry entries above are mandatory event types for version 0.1. Unknown mandatory event types MUST NOT be applied, per `82-limits-and-validation.md`.

## 34.3 ACCOUNT_CREATED (0)

Auth: `GENESIS`. The event is signed by the account identity key, whose public key is in the body. The `account_id` in the envelope MUST be derivable from the body's `identity_public_key` per `10.5`, and MUST match. The envelope `device_id` is empty for this event, because the event is signed by the identity key rather than by a device; the first device is established by the authorization record in the body.

`ACCOUNT_CREATED` establishes the account's cryptographic trust chain. The body MUST contain a `FirstDeviceAuthorization` record signed by the account identity key. After acceptance, the authorized device is the account's trusted device.

Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `identity_public_key` | bytes(32) | yes | The account identity Ed25519 public key. |
| 1 | `username` | text | yes | Initial canonical username, per `11.6`. |
| 2 | `home_instance` | bytes(32) | yes | `instance_id` of the home instance, per `13-instances.md`. |
| 3 | `first_device_authorization` | `FirstDeviceAuthorization` | yes | Identity-key-signed authorization of the first trusted device. |

`FirstDeviceAuthorization` is the CBOR map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `authorization_version` | text | yes | Protocol version `"0.1"`. |
| 1 | `account_id` | bytes(32) | yes | MUST equal the envelope `account_id` and derive from `identity_public_key`. |
| 2 | `device_id` | bytes(16) | yes | The first device identifier, per `10.4`. |
| 3 | `device_signing_public_key` | bytes(32) | yes | The first device's Ed25519 public key, per `20.3`. |
| 4 | `device_encryption_public_key` | bytes(32) | yes | The first device's X25519 public key, per `20.4`. |
| 5 | `device_kind` | uint | yes | Per `12.5`; MUST NOT be `1` (`backup`), per `12.4`. |
| 6 | `identity_signature` | bytes(64) | yes | Ed25519 signature by the account identity key, per `22.9`. |

The `device_id` is generated as 16 random bytes per `10.4`. Correspondence between `device_id` and the device public keys is established only by this signed record: a validator MUST NOT accept a device identifier to public-key pairing from an unsigned source.

A validator processing `ACCOUNT_CREATED` MUST be able to:

1. obtain the account identity public key (body key 0);
2. obtain the first device's public keys (authorization keys 3 and 4);
3. verify the identity signature (`22.9`) over the authorization record;
4. verify that the authorization record binds `device_id`, `device_signing_public_key`, and `device_encryption_public_key` together as one signed unit;
5. establish the first device as the initial trusted device;
6. subsequently verify events signed by that device, per `42-identity-and-authorization.md`.

Rejection behavior:

| Condition | Error |
| --------- | ----- |
| Missing first-device authorization, malformed record, `account_id` mismatch, or `device_kind = 1` | `E_FIRST_DEVICE_INVALID` |
| Invalid identity signature | `E_SIGNATURE_INVALID` |
| Wrong field types or lengths | `E_MALFORMED_ENCODING` or `E_BAD_REQUEST` |
| Unsupported key algorithm | `E_MANDATORY_UNKNOWN` |
| Second `ACCOUNT_CREATED`, or a device already bound to different keys or a different account, for the same `account_id` | `E_TRUST_CONFLICT` |

`ACCOUNT_CREATED` MUST be the first event of an account. No other event type may precede it in the account's DAG. The account identity key signs exactly the set of `GENESIS`-level events; for version 0.1 that is only `ACCOUNT_CREATED`.

## 34.4 DEVICE_AUTHORIZED (1)

Auth: `TRUSTED`. The new device becomes `authorized`.

Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `device_id` | bytes(16) | yes | The new device identifier. |
| 1 | `signing_public_key` | bytes(32) | yes | The new device's Ed25519 public key. |
| 2 | `encryption_public_key` | bytes(32) | yes | The new device's X25519 public key. |
| 3 | `device_kind` | uint | yes | Per `12.5`. |
| 4 | `display_name` | text | no | Optional display name. |

The same `device_id` to public-key binding rule as `34.3` applies: `device_id` is 16 random bytes, and the signed `DEVICE_AUTHORIZED` event is the record that binds the identifier to `signing_public_key` and `encryption_public_key`. A validator MUST reject the event if the same `device_id` is already bound to different keys or to a different account (`E_TRUST_CONFLICT`), or if the device is bound without a valid authorizing signature (`E_UNAUTHORIZED_DEVICE`).

## 34.5 DEVICE_REVOKED (2)

Auth: `TRUSTED`. The device becomes `revoked` and MUST NOT sign new account events, per `41-device-lifecycle.md`.

Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `device_id` | bytes(16) | yes | The revoked device. |
| 1 | `reason` | uint | no | Reason code, per `34.12`. |

Revoking the currently trusted device is not possible without a concurrent `TRUSTED_DEVICE_TRANSFERRED`; see `41.4`.

## 34.6 TRUSTED_DEVICE_TRANSFERRED (3)

Auth: `TRUSTED` (the current trusted device). After the event becomes authoritative, the new device is the trusted device and the previous trusted device becomes `superseded` (unless it is the same device id).

Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `new_trusted_device_id` | bytes(16) | yes | The device that becomes trusted. |

The new trusted device MUST currently be `authorized`. A `backup` kind device MUST NOT be the trusted device.

## 34.7 USERNAME_CHANGED (4)

Auth: `TRUSTED`.

Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `previous_username` | text | yes | The canonical username before this change. |
| 1 | `new_username` | text | yes | The canonical username after this change. |

The `previous_username` MUST match the account's current canonical username at the point this event becomes authoritative. The old username remains reserved for the account for 90 days from the event's effective time, per `40-account-lifecycle.md`.

## 34.8 ACCOUNT_DELETED (5)

Auth: `TRUSTED`. After authoritative, the account MUST be treated as deleted, per `40-account-lifecycle.md`.

Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `reason` | uint | no | Optional reason code. |

## 34.9 Relationship events (6 to 11)

Auth: `AUTHORIZED`. The subject of the action is always the event's own `account_id`; the target is `target_account_id`.

Body for `FOLLOW_CREATED` (6), `FOLLOW_REMOVED` (7), `BLOCK_CREATED` (8), `BLOCK_REMOVED` (9), `MUTE_CREATED` (10), `MUTE_REMOVED` (11):

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `target_account_id` | bytes(32) | yes | The account the relationship applies to. |

A relationship event MUST NOT target the account's own `account_id`. Semantics are defined in `50-social-relationships.md`.

## 34.10 Content events (12 to 16, 24)

Auth: `AUTHORIZED`.

* `PROFILE_UPDATED` (12): `object_references` contains exactly one reference to a profile object version. Body is empty.
* `POST_CREATED` (13): `object_references` contains exactly one reference (object + version) to a post object. Body is empty.
* `POST_EDITED` (14): `object_references` contains exactly one reference to the new post version. Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `previous_version_id` | bytes(32) | yes | The `version_id` the new version replaces. |

* `POST_DELETED` (15): `object_references` contains exactly one reference (object id) to the deleted post. Body is empty.
* `REPLY_CREATED` (16): `object_references` contains exactly one reference to the reply object version. Body optionally names the parent:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `parent_reference` | object_reference | no | The object and optional version being replied to, per `32.2`. |

* `MESSAGE_CREATED` (24): `object_references` contains exactly one reference to a `direct_message` object. Body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `context` | bytes(16) | no | The conversation or group identifier, when applicable. |

Content object semantics, versioning, and conflict rules are in `55-content.md`. The referenced object's `object_type` MUST match the event type: profile events reference `profile` objects, post events reference `post` objects, reply events reference `reply` objects, and message events reference `direct_message` objects.

## 34.11 Group events (17 to 23)

Auth: `MEMBER` except where noted.

* `GROUP_CREATED` (17), Auth `AUTHORIZED`:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `group_id` | bytes(16) | yes | Loopable group identifier; the MLS `group_id`. |
| 1 | `name` | object_reference | no | Optional reference to a `group_metadata` object version carrying the display name. |

* `GROUP_DELETED` (18):

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `group_id` | bytes(16) | yes | The deleted group. |

* `GROUP_MEMBER_ADDED` (19):

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `group_id` | bytes(16) | yes | |
| 1 | `epoch` | uint | yes | The MLS epoch after the add commit. |
| 2 | `member_account_id` | bytes(32) | yes | Added account. |
| 3 | `member_device_id` | bytes(16) | no | A specific added device; empty means all authorized devices of the account. |

* `GROUP_MEMBER_REMOVED` (20):

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `group_id` | bytes(16) | yes | |
| 1 | `epoch` | uint | yes | The MLS epoch after the remove commit. |
| 2 | `member_account_id` | bytes(32) | yes | Removed account. |
| 3 | `member_device_id` | bytes(16) | no | A specific removed device; empty means the whole account. |

* `GROUP_JOINED` (21), Auth `AUTHORIZED` (the joining subject). `object_references` MAY reference the Welcome message object.

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `group_id` | bytes(16) | yes | |
| 1 | `epoch` | uint | yes | The MLS epoch joined. |

* `GROUP_LEFT` (22):

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `group_id` | bytes(16) | yes | |
| 1 | `epoch` | uint | yes | The MLS epoch after the leave. |

* `GROUP_UPDATED` (23). `object_references` MAY reference the commit (MLS_MESSAGE) object.

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `group_id` | bytes(16) | yes | |
| 1 | `epoch` | uint | yes | The MLS epoch resulting from this update. |

Group event semantics are defined in `53-contexts-and-membership.md` and `25-mls.md`.

## 34.12 Reason codes

Reason code values for `DEVICE_REVOKED` and `ACCOUNT_DELETED`:

| Code | Meaning |
| ---- | ------- |
| 0 | Unspecified |
| 1 | Device lost |
| 2 | Device stolen |
| 3 | Device compromised |
| 4 | User request |
| 5 | Account deletion at user request |

Unknown reason codes MUST be treated as `0`.

## 34.13 Validation summary

Every event is validated per `22.5`. The additional per-type validation is:

* the auth level of `34.1` is satisfied by the signing device;
* the body matches the schema for its `event_type` exactly;
* the `object_references` cardinality and types match the event type;
* any cross-field requirements in this module hold (for example the derivable `account_id` in `ACCOUNT_CREATED`, or `MEMBER`-level group events being signed by a current member of that group).

An event that fails any of these MUST be rejected. New event types are registered per `101-implementation-requirements.md`.