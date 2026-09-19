# 42. Identity and authorization

This module defines how a validator resolves an event's signer, the account's trust state, and whether the signer was authorized for the event.

## 42.1 The trust chain

The trust chain is:

```text
Account identity key
        |
        | signs ACCOUNT_CREATED (genesis) containing FirstDeviceAuthorization
        v
First device  ->  trusted device
        |
        | signs DEVICE_AUTHORIZED / TRUSTED_DEVICE_TRANSFERRED / DEVICE_REVOKED
        v
Authorized devices
        |
        | sign ordinary events
        v
Events
```

The account identity key signs only `GENESIS`-level events. The trusted device signs account- and device-level events and all other authority-bearing events. Ordinary authorized devices sign content, relationship, message, and membership events.

### 42.1.1 The trusted-device rule

The whole authority model reduces to one rule: after genesis, all account-management authority flows through the account's single trusted device.

```text
Account identity key
        |
        | authorizes exactly one initial trusted device (in ACCOUNT_CREATED)
        v
Initial trusted device
        |
        | becomes the account's ongoing operational authority
        v
Trusted device
        |
        | authorizes all future account-management operations
        v
DEVICE_AUTHORIZED / TRUSTED_DEVICE_TRANSFERRED / DEVICE_REVOKED / USERNAME_CHANGED / ACCOUNT_DELETED
```

The account identity key is used only once, to create the account. From then on, the trusted device is the operational authority for the account: only the current trusted device may sign `GENESIS`-exempt account-management events (`TRUSTED` level, `34.1`), and only it may name the next trusted device (`TRUSTED_DEVICE_TRANSFERRED`). No other device, and not the account identity key, can authorize, revoke, or transfer device authority. A device that is not currently trusted can never sign a `TRUSTED`-level event, even if it is otherwise authorized.

## 42.2 The authorization index

A validator computes the authorization index of an account from the account's event DAG. The index records, for each device:

* device status (`authorized`, `revoked`, `superseded`) per `41.6`;
* the current trusted device id.

The index is derived by processing the account's events in a topological order that respects the causal edges of `63-event-dependencies.md`. The index is authoritative for deciding whether a device may sign an event type.

## 42.3 Causal authorization rule

For an event `E` signed by device `D`, the validator MUST evaluate authorization in a causal way:

1. Build the set of authorization-relevant events (`ACCOUNT_CREATED`, `DEVICE_AUTHORIZED`, `DEVICE_REVOKED`, `TRUSTED_DEVICE_TRANSFERRED`, `ACCOUNT_DELETED`) that are causal predecessors of `E`.
2. Compute `D`'s status and the trusted device as of those predecessors.
3. `E` is authorizable only if `D` is `authorized` at that point, and `E`'s event type's auth level (`34.1`) is satisfied.

A `DEVICE_REVOKED` or `TRUSTED_DEVICE_TRANSFERRED` event affects only events that causally follow it. An event concurrent with a revocation remains valid, because it was produced before the revocation was known. This preserves the rule that previously valid events do not become invalid because the device was later revoked.

If two different `TRUSTED_DEVICE_TRANSFERRED` events both causally precede `E` and neither is an ancestor of the other, the account's trusted-device state is ambiguous. The validator MUST treat this as a protocol integrity error, MUST NOT apply `E`, and MUST record the conflict per `64-conflict-resolution.md`.

## 42.4 Rejection of unauthorized signers

An event signed by:

* a device never authorized for the account;
* a device `revoked` before `E` (per `42.3`);
* a device `superseded` before `E`;
* a device without the required auth level for the event type (for example an ordinary authorized device signing a `DEVICE_REVOKED`)

MUST be rejected with error code `E_UNAUTHORIZED_DEVICE` (`80-errors.md`).

A device whose merely claimed authorization is revoked does not invalidate previously signed events.

An `ACCOUNT_CREATED` event whose `FirstDeviceAuthorization` is missing, malformed, or inconsistent with the account identity or device binding MUST be rejected with `E_FIRST_DEVICE_INVALID`. A conflicting first-device authorization for an account that already has a genesis device MUST be rejected with `E_TRUST_CONFLICT`.

## 42.5 Validation procedure for an incoming event

A validator MUST process an incoming event `E` as follows:

1. Run the structural validation steps of `22.5` (decode, field types, lengths, version, signature).
2. Ensure the account's authorization index is fully buildable from known events; otherwise place `E` in the pending state per `63-event-dependencies.md`.
3. If `E` is `ACCOUNT_CREATED`, validate its `FirstDeviceAuthorization` per `34.3` and `22.9`, and seed the authorization index with the authorized device as the initial trusted device. Reject per `34.3` on failure.
4. Compute the causal predecessor set of `E` and the authorization state per `42.3`.
5. Verify the signer's authority level for the event type per `34.1`.
6. Verify any cross-field requirements of `34-event-types.md`.
7. Apply `E` to the index and the application state.

Failure at any step MUST cause rejection. The result is recorded per `100-conformance.md`.

## 42.6 Instance role

An instance MAY store and distribute signed authorization events and MAY serve the authorization index to clients. It MUST NOT manufacture authorization events. A lookup of the authorization index MUST return only the derived index, never private key material, per `13.6`.

## 42.7 Account identity immutability

The account identity key never changes. An event that directly claims a new account identity key MUST be rejected: `ACCOUNT_CREATED` is the only genesis event, and it can occur only once for an `account_id`. Reuse of `account_id` by a different identity key after deletion is forbidden per `40.4`.