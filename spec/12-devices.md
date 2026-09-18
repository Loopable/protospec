# 12. Devices

This module defines devices, device keys, device authorization, and the trusted-device model.

## 12.1 Device

A device is a physical or logically isolated client installation that holds its own cryptographic key material. Each device has a unique `device_id` (16 random bytes, per `10-identifiers.md`), an Ed25519 signing key pair, and an X25519 encryption and key-agreement key pair.

The device signing key and the device encryption key MUST be generated independently. The signing key MUST NOT be used for encryption and the encryption key MUST NOT be used for signing, per `21-key-management.md`.

## 12.2 Device record

The device record is the account-visible description of a device. Its wire form is defined by `32-event-envelope.md` and `34-event-types.md`; the abstract fields are:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `device_id` | 16 bytes | Random device identifier. |
| `signing_public_key` | 32 bytes | Ed25519 public key used to verify device event signatures. |
| `encryption_public_key` | 32 bytes | X25519 public key used for object-key wrapping. |
| `device_kind` | enum | Client device type, per `12.5`. |
| `display_name` | text | Optional human name assigned by the user. |
| `created_at` | time | Device provisioning time, per `31-wire-types.md`. |
| `status` | enum | `authorized`, `revoked`, `superseded`. |

The `device_id` is assigned by the client that provisions the device, not by the instance or by the protocol. It is generated as 16 random bytes per `10.4`; it is not a hash of the device public keys. The binding between a `device_id` and the device public keys is established by a signed authorization record and only by such a record:

* the first device is bound by the `FirstDeviceAuthorization` record inside `ACCOUNT_CREATED`, signed by the account identity key (`34.3`, `22.9`);
* every subsequent device is bound by a `DEVICE_AUTHORIZED` event signed by the account's trusted device (`34.4`).

An unsigned or self-asserted device identifier MUST NOT be accepted as evidence of a device's keys.

## 12.3 Authorization chain

A device is authorized by a signed authorization record. The trust chain is:

```text
Account identity key
        |
        | signs FirstDeviceAuthorization in ACCOUNT_CREATED
        v
First device  ->  trusted device
        |
        | signs DEVICE_AUTHORIZED events
        v
Authorized devices
```

The first device of an account is authorized directly by the account identity key through the `FirstDeviceAuthorization` record in the `ACCOUNT_CREATED` event, per `34.3`. Every subsequent device is authorized by the account's current trusted device through a `DEVICE_AUTHORIZED` event.

A device MUST NOT be considered authorized merely because an instance database says it is authorized. The validator MUST cryptographically validate the trust chain from the account identity key to the device, per `42-identity-and-authorization.md`.

## 12.4 Trusted device

An account MUST have exactly one trusted device at any time.

The trusted device is the device whose signing key currently holds trusted-device authority. Trusted-device authority includes, and is limited to:

* authorizing a new device (`DEVICE_AUTHORIZED`);
* revoking a device (`DEVICE_REVOKED`);
* transferring trusted-device status (`TRUSTED_DEVICE_TRANSFERRED`);
* modifying account-level security state (username change, account deletion).

The trusted device changes only through a `TRUSTED_DEVICE_TRANSFERRED` event signed by the current trusted device.

An instance has none of these authorities. An instance MAY store and distribute signed authorization events, and MUST NOT manufacture them.

## 12.5 Device kinds

The `device_kind` enum values for version 0.1:

| Value | Code | Meaning |
| ----- | ---- | ------- |
| `client` | 0 | General client (phone, desktop, web). |
| `backup` | 1 | A backup holder. A backup device is a device for key-storage purposes only and MUST be explicitly recognized as such in the UI. |
| `service` | 2 | A non-interactive service acting on behalf of the account. |

A backup device is still a device: it is subject to the same authorization and revocation rules. A backup MUST NOT silently become the trusted device; trusted-device authority always requires an explicit `TRUSTED_DEVICE_TRANSFERRED` event from the currently trusted device.

## 12.6 Device status transitions

A device status is `authorized`, `revoked`, or `superseded`.

* Provisioned and authorized: `authorized`.
* Revoked by the trusted device: `revoked`. A revoked device MUST NOT sign new account events, per `41-device-lifecycle.md`. Previously valid events signed by the device remain cryptographically valid.
* Superseded: a device that held trusted-device status and transferred it to another device, or that was rotated out during a trusted-device transfer, is `superseded`. A superseded device MUST NOT sign new account events.

The status transitions are driven exclusively by signed events. The event type registry in `34-event-types.md` defines the allowed transitions and authorization requirements.

## 12.7 Device identity binding to MLS

When a device participates in an MLS group, its MLS identity MUST be bound to the device keys as defined in `25-mls.md`. An instance MUST NOT be able to substitute a different user's MLS identity.