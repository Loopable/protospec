# 40. Account lifecycle

This module defines registration, username changes, account deletion, and the limits around them.

## 40.1 Registration

Account registration is the process of creating an identity and registering it with a home instance.

1. The client generates an account identity Ed25519 key pair, per `20.3`.
2. The client derives the `account_id` per `10.5`.
3. The client provisions its first device with a device signing key, a device encryption key, and a random `device_id`, per `41.1`.
4. The client constructs a `FirstDeviceAuthorization` record binding the `account_id` to the first device's `device_id`, signing public key, and encryption public key, and signs it with the account identity private key per `22.9`.
5. The client constructs an `ACCOUNT_CREATED` event per `34.3` whose body contains the identity public key, the username, the home instance, and the first-device authorization record, sets its signing key to the account identity private key, and signs it per `22-signatures.md`.
6. The client submits the event to the selected home instance per `60-federation.md`. The instance hosts the account according to its local membership policy.

After an `ACCOUNT_CREATED` event is accepted, the first device is the account's trusted device, per `41.2`. An instance MUST NOT be required to establish that trust: a validator derives it from the account identity public key, the first-device authorization record, and the identity signature.

## 40.2 Username registration

A username MAY be registered for an account only if it matches the grammar of `11.6` and is available on the home instance.

Availability rules:

1. A username in use by another account on the instance is unavailable.
2. A username reserved by a former account per `40.3` is unavailable until the reservation expires.
3. Username availability is otherwise instance-local policy.

The same username on another instance names a different account, per `11.4`.

## 40.3 Username changes

A user MAY change their username. A username change MUST be represented by a `USERNAME_CHANGED` event, signed by the trusted device, per `34.7`. The event cryptographically binds the previous username, the new username, the account identity, the effective time (`created_at`), and the predecessor events.

Reservation rule:

* The old username remains reserved for the account for exactly 90 days, measured from the effective time of the `USERNAME_CHANGED` event.
* During the reservation, another account MUST NOT claim the old username.
* After the reservation expires, the old username MAY be registered by another account.
* Once reused by another account, the new account MUST be treated as cryptographically unrelated to the former account.
* Clients MUST NOT infer identity continuity from username reuse. Identity is the `account_id` and the identity public key.

## 40.4 Account deletion

Account deletion MUST be represented by an `ACCOUNT_DELETED` event signed by the trusted device, per `34.8`.

Semantics:

1. Account deletion does not retroactively invalidate historical cryptographic signatures.
2. Clients MUST treat the account as deleted after the deletion event becomes authoritative.
3. Instances SHOULD delete local encrypted objects according to their retention policy.
4. Because replicas may exist, Loopable MUST NOT claim that an `ACCOUNT_DELETED` event physically erases every copy of every historical object. Physical deletion and semantic deletion are separate, per `65-object-storage.md`.

On an authoritative `ACCOUNT_DELETED` event, the following effects apply:

| Artifact | Semantic effect | Physical effect |
| -------- | --------------- | --------------- |
| Historical events | Cryptographic validity unchanged; must not be applied to new state | Unchanged; replicas may retain them |
| Encrypted objects owned by the account | Treat as deleted per retention policy (`65.7`) | Local store SHOULD delete; replicas and caches may retain ciphertext |
| Recipient records and keys | No new recipients; existing recipients keep access only while they retain keys | Clients SHOULD delete keys per `65.6` |
| Username | Released to reservation per `40.3` | Instance removes reservation after the interval |
| Account lookup (`60.8`) | Returns `state` `1` (deleted) | - |
| Account identity key | MUST NOT be reused; the account does not reappear | - |

There is no account "restore" defined by the protocol. A deleted account's identity key MUST NOT be reused; recreation is a new account.

## 40.5 Account relocation

Account identity and account hosting are separate concepts. Version 0.1 does not define account migration between instances. Any future migration MUST preserve the account identity key, MUST NOT create a new identity when the hosting instance changes, and MUST be represented by authenticated state transitions. An instance MUST NOT create a new identity merely because hosting changes. Implementation of migration is a protocol extension per `101-implementation-requirements.md`.