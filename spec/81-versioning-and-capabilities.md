# 81. Versioning and capabilities

This module is the authoritative definition of protocol versioning, capability negotiation, and downgrade protection.

## 81.1 Version scheme

Protocol versions use `MAJOR.MINOR`.

* A major-version change MAY introduce incompatible wire behavior.
* A minor-version change MUST preserve compatibility with the previous minor version of the same major version, unless a specific feature is explicitly marked otherwise.
* Implementations MUST reject versions with an unsupported major version.

The version 0.1 protocol version string is `"0.1"`. It appears as `protocol_version` in events (`32.2`), objects (`33.2`), and instance documents (`13.3.1`).

## 81.2 Version acceptance

An implementation:

1. MUST accept a message whose full `MAJOR.MINOR` version it supports.
2. MUST reject a message whose major version it does not support, with `E_UNSUPPORTED_VERSION` (`80-errors.md`).
3. MUST NOT accept a message whose minor version it cannot process when the message uses fields added in that minor version.

Version negotiation is explicit: there is no silent algorithm substitution. A message MUST declare its protocol version or be associated with a versioned endpoint; version 0.1 endpoints are fixed to `"0.1"` for the endpoints in `60-federation.md`.

## 81.3 Capabilities

Instances SHOULD advertise supported capabilities at `GET /v1/capabilities`. The body is a CBOR array of capability records:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `id` | text | yes | Stable capability identifier. |
| 1 | `version` | text | yes | Semver-like version that MUST be resolved by identity, `MAJOR.MINOR`. |
| 2 | `mandatory` | bool | yes | Whether a peer MUST support it to interoperate. |

Rules:

1. Unknown optional capabilities MUST be safely ignored.
2. Unknown mandatory capabilities MUST cause an explicit incompatibility response: `E_UNSUPPORTED_CAPABILITY` (`80-errors.md`).
3. Capability negotiation MUST NOT silently change security semantics.
4. A capability MUST have a stable identifier, a version, documented security implications, and documented compatibility behavior.

### Registered capabilities

| ID | Version | Mandatory | Meaning |
| -- | ------- | --------- | ------- |
| `events` | 0.1 | yes | Signed events, event envelope, dependency resolution. |
| `objects` | 0.1 | yes | Encrypted object envelopes, AES-256-GCM content. |
| `account-lookup` | 0.1 | yes | Account lookup endpoint (`60.8`). |
| `sync-v1` | 0.1 | yes | Cursor synchronization (`62.2`). |
| `mls-1.0` | 1.0 | yes when groups are used | MLS group cryptography (`25-mls.md`). |
| `webpush` | 0.1 | no | Optional push notifications. |

## 81.4 Algorithm agility and downgrade protection

* Protocol cryptographic algorithms are versioned. An implementation MUST NOT silently substitute another algorithm.
* Future cryptographic suites MUST receive explicit protocol identifiers, and the meaning of an existing encryption-suite identifier MUST NEVER change.
* An attacker MUST NOT be able to force two implementations to use a weaker algorithm by removing capability advertisements.
* Minimum algorithm requirements are fixed: an implementation supporting Loopable 0.1 MUST support Ed25519, X25519, SHA-256, HKDF-SHA-256, AES-256-GCM, HPKE (X25519/HKDF-SHA256/AES-256-GCM), MLS `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`, TLS 1.3, and deterministic CBOR, per `20.2`.

## 81.5 Extensions

Adding an event type, object type, capability, error code, or enum value is a protocol extension that MUST follow `101-implementation-requirements.md`. Extensions MUST NOT change the meaning of existing fields and MUST NOT reuse registered identifiers.