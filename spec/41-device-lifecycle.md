# 41. Device lifecycle

This module defines device provisioning, authorization, transfer, revocation, and loss.

## 41.1 Provisioning

Provisioning is performed on the device by its owner:

1. Generate an Ed25519 device signing key pair and an X25519 device encryption key pair, independently, per `21.4`.
2. Generate a random 16-byte `device_id`, per `10.4`.
3. Submit the device's public keys and `device_id` to the account's home instance as a device join request (`60.10`).
4. The home instance notifies the account's trusted device, which presents an approval prompt showing the device's `device_id`, `device_kind`, display name, and public keys (`72.2`). The user approves on the trusted device.
5. The trusted device signs a `DEVICE_AUTHORIZED` event per `34.4`.
6. After the event becomes authoritative, the new device is an authorized device. Only then may it submit account events.

Approval MAY instead happen out of band (for example a pairing handshake over a trusted channel), but the protocol-enabled flow is the join request followed by a prompt on the trusted device. In every case the binding is the signed `DEVICE_AUTHORIZED` event; nothing else authorizes the device.

Private keys MUST NOT be transferred through an instance. The old device's private keys MUST NOT be uploaded to the new device through Loopable federation.

## 41.2 First device

The first device of an account is established by the `FirstDeviceAuthorization` record carried in `ACCOUNT_CREATED`, per `34.3`, signed by the account identity key per `22.9`. The record binds:

```text
account_id
device_id                 (16 random bytes, per 10.4)
device_signing_public_key (Ed25519, per 20.3)
device_encryption_public_key (X25519, per 20.4)
device_kind               (must not be backup, per 12.4)
```

When the `ACCOUNT_CREATED` event becomes authoritative and its first-device authorization verifies, the first device is the account's trusted device. A validator establishes this from protocol data alone: the account identity public key, the authorization record, and the identity signature. It MUST NOT depend on an instance signature or on instance state.

## 41.3 Trusted-device transitions

An account MUST have exactly one trusted device at any time.

The trusted device changes only through `TRUSTED_DEVICE_TRANSFERRED`. A transfer consists of:

1. Provisioning and authorizing the new device per `41.1` (unless it is already authorized).
2. The current trusted device signs `TRUSTED_DEVICE_TRANSFERRED` naming the new device per `34.6`.
3. Activation: when the event becomes authoritative, the new device is the trusted device.
4. The previous trusted device becomes `superseded` and MUST NOT sign new account events.

The "trusted device at an event" is resolved by the rules of `42.3`. A transfer event MUST be signed by the device that is trusted according to those rules at that point.

## 41.4 Revocation

Device revocation is represented by a `DEVICE_REVOKED` event signed by the trusted device, per `34.5`.

After a revocation becomes effective, implementations MUST reject new account activity signed only by the revoked device. Previously valid events signed by that device do not become cryptographically invalid merely because the device was later revoked, per `42.3`.

The currently trusted device cannot be revoked while no transfer exists. An implementation MUST reject a `DEVICE_REVOKED` whose target is the trusted device unless a `TRUSTED_DEVICE_TRANSFERRED` event naming a new trusted device causes the target to no longer be trusted at the revocation point.

## 41.5 Lost trusted device

If the sole trusted device is permanently lost and no previously authorized trusted-device replacement exists, the account is permanently inaccessible.

The protocol MUST NOT provide instance-admin recovery, support-agent recovery, email recovery, password-based cryptographic recovery, centralized recovery keys, or Foundation recovery. This is deliberate.

An implementation MAY provide user-interface warnings explaining this property. It MUST NOT silently weaken it.

## 41.6 Device states

| State | Entering | Exiting |
| ----- | -------- | ------- |
| `authorized` | `ACCOUNT_CREATED` (first device) or `DEVICE_AUTHORIZED` | `DEVICE_REVOKED` or transfer as `new_trusted_device` on the previous device |
| `revoked` | `DEVICE_REVOKED` | none |
| `superseded` | `TRUSTED_DEVICE_TRANSFERRED` on the previous trusted device | none |

A `revoked` or `superseded` device MUST be rejected as the signing device of any new account event, per `42.4`.

## 41.7 Device transfer isolation

Device transfer never moves key material. It changes the trust pointer only. A compromised trusted device can transfer trust to an attacker-controlled device; the user who controls the account identity cannot be protected from a compromise of their own trusted device. The threat model for this is in `92-threat-model.md`.