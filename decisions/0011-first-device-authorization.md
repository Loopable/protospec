# 0011: First-device authorization is a signed record in ACCOUNT_CREATED

* Status: accepted
* Basis: `spec/34-event-types.md` 34.3, `spec/22-signatures.md` 22.9, `spec/41-device-lifecycle.md` 41.2

## Context

`ACCOUNT_CREATED` left the first device implicit: the event named a `device_id` but carried no device public keys and no device authorization. A validator could not learn the first device's keys, so it had to trust the instance's device table to start the authorization chain. That made the instance a trust anchor for the first device, which contradicts the protocol's privacy model.

## Alternatives

1. Keep the implicit first device and trust the instance device table. Rejected: an instance could substitute the first device and sign events as the account.
2. Derive the first `device_id` as a hash of the device public keys and accept it without a record. Rejected: a hash-based ID binds keys to an ID but proves nothing about who authorized them.
3. Add an account-identity-signed `FirstDeviceAuthorization` record to the `ACCOUNT_CREATED` body that binds `account_id`, `device_id`, and both device public keys. Chosen.

## Decision

The `ACCOUNT_CREATED` body carries `first_device_authorization` at body key `3`. The record is signed by the account identity key over the domain-separated input `loopable-first-device-authorization-v1` `0x00` per `spec/22-signatures.md` 22.9. `device_id` remains 16 random bytes (`spec/10-identifiers.md` 10.4); the signed record, not the identifier's construction, establishes the device-to-key binding. The envelope `device_id` is empty for this event.

A validator establishes the first trusted device from protocol data alone. Failure maps to `E_FIRST_DEVICE_INVALID`; a conflicting genesis device maps to `E_TRUST_CONFLICT`.

## Consequences

* The account identity key is the sole root of the device trust chain.
* Instances are no longer trust anchors for the first device.
* A new domain-separation label is registered in `spec/20-cryptographic-primitives.md` 20.12.
* `ACCOUNT_CREATED` gains a required body field; this is a wire change that predates 1.0.
