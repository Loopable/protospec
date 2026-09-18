# 21. Key management

This module defines the key types the protocol uses, how they are separated, how they are protected, and how their lifecycles behave.

## 21.1 Key types

The protocol defines these principal key types:

| Key type | Algorithm | Role | Holder |
| -------- | --------- | ---- | ------ |
| Account identity key | Ed25519 | Roots the account; authorizes the initial device | User (client) |
| Device signing key | Ed25519 | Signs ordinary account events | Device |
| Device encryption key | X25519 | Receives wrapped object keys | Device |
| Instance root key | Ed25519 | Roots instance identity | Instance operator |
| Instance operational key | Ed25519 | Signs federation requests | Instance |

## 21.2 Domain separation of keys

Every Loopable cryptographic construction has an explicit purpose. The same key material MUST NOT be used interchangeably between account signing, device signing, object encryption, HPKE, MLS, and instance signing. Different purposes MUST use different key types or cryptographically separated contexts.

The account Ed25519 identity key is a signing identity. It MUST NOT be directly used as an X25519 encryption key. The device signing key and device encryption key MUST be generated independently and MUST NOT be cross-used.

## 21.3 Instance signing versus TLS

Instance Ed25519 identity keys authenticate Loopable protocol identity. TLS keys authenticate TLS sessions. They are separate. An instance MUST NOT derive its Loopable identity from its TLS certificate, and changing a TLS certificate MUST NOT change the Loopable instance identity.

## 21.4 Private-key generation

Private keys MUST be generated from a cryptographically secure random source, per `20.11`.

## 21.5 Private-key protection

Private keys MUST NOT be written to ordinary plaintext application logs, analytics, crash reports, federation requests, debug output, test fixtures, or Git repositories.

Private keys SHOULD be stored using OS-backed secure storage where available. Client-sensitive state MUST be protected by the platform's secure storage mechanisms per `90-security.md`.

## 21.6 Key lifecycle

Transcript of a key's lifecycle:

| Stage | Rules |
| ----- | ----- |
| Generation | Cryptographically secure random source; independent generation per key type. |
| Provisioning | Device keys are provisioned on the client; only public keys are published to the account and instances. |
| Use | Subject to the algorithms and purposes of `20-cryptographic-primitives.md`. |
| Rotation | Account identity keys MUST NOT rotate. Device keys rotate through `DEVICE_AUTHORIZED` / `DEVICE_REVOKED` events. Instance operational keys rotate through `OPERATIONAL_KEY` records. |
| Destruction | Clients SHOULD destroy keys no longer required, per `90-security.md`. Cryptographically secure secure-wipe methods SHOULD be used where the OS supports them. |
| Compromise | See `92-threat-model.md` and `90-security.md`. |

## 21.7 Device key rotation

A device that loses its key material, or whose key is compromised, MUST be revoked by a `DEVICE_REVOKED` event and replaced by a new device authorized by the trusted device, per `41-device-lifecycle.md`. If the sole trusted device is lost, recovery is permanently impossible, per `41.5`.

## 21.8 Key backup

Backups are implementation-defined. A client MAY back up encrypted account and device material. A backup system MUST NOT silently become a second trusted device. If a backup contains sufficient private key material to recover an account, that recovery mechanism MUST be explicitly defined and user-controlled. The base protocol does not define such a mechanism.

## 21.9 Key destruction after revocation

Clients SHOULD destroy encryption keys that are no longer required. This is especially important for private messages, deleted posts, revoked group members, deleted groups, and expired content, per `65-object-storage.md` and `90-security.md`. Cryptographic deletion can make ciphertext undecryptable even when physical ciphertext remains.