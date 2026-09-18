# 60. Federation

This module is the authoritative definition of the federation transport: how instances exchange events, objects, and synchronization state.

## 60.1 Model

Loopable federation is an authenticated event/object protocol. It is NOT a command replication system. Instances do not exchange operations such as "create post" or "follow user". They exchange:

* authenticated events, which represent state transitions;
* encrypted objects, which carry application data;
* synchronization metadata, which drives discovery of missing data.

Instances synchronize only data relevant to them. There is no replication of the entire network.

## 60.2 Conditions

Every exchange between instances is:

1. over HTTPS, per `13.8`;
2. authenticated by the sending instance, per `61-federation-authentication.md`;
3. validated end-to-end: event signatures and object integrity are verified per `22-signatures.md` and `23-encryption.md`; the sending instance's authentication never substitutes for application-level validation.

## 60.3 Endpoints

All endpoints below are rooted at `/v1`. Bodies are CBOR with `Content-Type: application/cbor`; responses are CBOR unless an HTTP-level error applies (`80-errors.md`). Query parameters are canonicalized per `61.6`. Requests and responses follow the authentication rules of `61-federation-authentication.md`.

| Method and path | Purpose |
| --------------- | ------- |
| `GET /v1/instance` | Return the instance document (`13.3.1`). Public: no authentication required. |
| `GET /v1/capabilities` | Return the capability list (`81-versioning-and-capabilities.md`). Public. |
| `POST /v1/events` | Submit one or more events. |
| `GET /v1/events/{event_id}` | Fetch a single event by its base32lower form. |
| `POST /v1/events:fetch` | Fetch a batch of events, including missing dependencies. |
| `POST /v1/objects` | Submit one or more encrypted objects. |
| `GET /v1/objects/{object_id}` | Fetch a single object by its base32lower form; optional `?version=` selects a version. |
| `POST /v1/sync` | Open or resume a synchronization stream, per `62-synchronization.md`. |
| `GET /v1/accounts/{account_id}` | Account lookup, per `13.6`. Requires member authorization. |
| `GET /v1/members/{account_id}` | Membership state of an account in an instance context. Requires member authorization. |

Path-embedded identifiers are the base32lower text form, per `10-identifiers.md`. An identifier in a URL MUST be verified to decode to the expected byte length.

## 60.4 Event submission

`POST /v1/events` accepts a CBOR array of events. Each event is validated independently per `22.5` and `42-identity-and-authorization.md`. The response is a CBOR array of result records:

| Key | Field | Type | Description |
| --- | ----- | ---- | ----------- |
| 0 | `event_id` | bytes(16) | The submitted event's id. |
| 1 | `status` | uint | `0` accepted, `1` duplicate, `2` rejected. |
| 2 | `error` | error_object | Present when `status` is `2`, per `80-errors.md`. |

Submitting events that the sender is not authorized to relay is subject to the sender's federation policy and the requirement that the sender prove its instance identity. The receiving instance MUST apply its `61.5` acceptance steps before storing.

## 60.5 Object submission

`POST /v1/objects` accepts a CBOR array of encrypted objects with the same response shape as `60.4` (`object_id` instead of `event_id`). A receiving instance MUST NOT decrypt objects; it verifies the envelope structure, keys, and authenticated metadata per `33-object-envelope.md`, then stores or forwards per `65-object-storage.md`. Unreadable ciphertext is never a protocol error, per `33.9`.

## 60.6 Retrieval

* `GET /v1/events/{event_id}` returns the event bytes, or `404` with error code `E_NOT_FOUND` (`80-errors.md`).
* `GET /v1/objects/{object_id}` returns the object bytes, or `404` with `E_NOT_FOUND`.
* `POST /v1/events:fetch` accepts `{0: event_ids: array<bytes(16)>}` and returns a CBOR array of `{0: event_id, 1: event (bytes, optional), 2: error (optional)}` records. A response MAY include additional dependency events beyond those requested, per `63-event-dependencies.md`. An instance MUST NOT fabricate an event to satisfy a dependency.

## 60.7 Selective federation

Instances MUST NOT replicate the entire network. An instance SHOULD exchange only:

* events relevant to its members;
* objects required by those events;
* objects explicitly requested;
* federation metadata required for synchronization;
* membership state relevant to federation policy.

An instance MAY refuse federation with another instance according to its local federation policy, including allowlists, blocklists, manual approval, protocol-version restrictions, resource limits, object-size limits, and rate limits. Local federation policy does not change the semantics of cryptographically valid events; it only determines whether the instance accepts or processes them, per `91-privacy.md`.

## 60.8 Account lookup

`GET /v1/accounts/{account_id}` requires member authorization (the requester must be a member of the receiving instance) and MUST return no more than the lookup data of `13.6`. Response map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `account_id` | bytes(32) | yes | |
| 1 | `identity_public_key` | bytes(32) | yes | |
| 2 | `handle` | text | yes | Canonical handle per `11.5`. |
| 3 | `home_instance` | bytes(32) | yes | |
| 4 | `device_summary` | array&lt;device_summary&gt; | yes | Bounded device summary, per `82-limits-and-validation.md` |
| 5 | `state` | uint | yes | `0` active, `1` deleted, per `40.4`. |

### device_summary

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `device_id` | bytes(16) | yes | |
| 1 | `trusted` | bool | yes | Whether this device is currently trusted. |
| 2 | `kind` | uint | yes | Device kind per `12.5`. |

The device summary MUST NOT include revoked devices, complete history, or private key material.

## 60.9 Limits

Endpoint-level limits are defined in `82-limits-and-validation.md`. Error conditions follow `80-errors.md`. Retryable failures are indicated by the `retryable` flag in the error object; clients and instances MUST respect it and MUST NOT assume immediate re-delivery.