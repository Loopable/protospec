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
| `GET /v1/instance/roles` | Return the instance staff roles (`13.10.4`). Public. |
| `GET /v1/capabilities` | Return the capability list (`81-versioning-and-capabilities.md`). Public. |
| `POST /v1/events` | Submit one or more events. |
| `GET /v1/events/{event_id}` | Fetch a single event by its base32lower form. |
| `POST /v1/events:fetch` | Fetch a batch of events, including missing dependencies. |
| `POST /v1/objects` | Submit one or more encrypted objects. |
| `GET /v1/objects/{object_id}` | Fetch a single object by its base32lower form; optional `?version=` selects a version. |
| `POST /v1/sync` | Open or resume a synchronization stream, per `62-synchronization.md`. |
| `GET /v1/accounts/{account_id}` | Account lookup, per `13.6`. Public accounts: no authentication. Private accounts: member authorization. |
| `GET /v1/members/{account_id}` | Membership state of an account in an instance context. Requires member authorization. |
| `POST /v1/device-join-requests` | Submit a new-device join request, per `60.10`. |
| `POST /v1/media/uploads` | Create a resumable media upload (tus `creation`), per `35.10`. |
| `PATCH /v1/media/uploads/{upload_id}` | Append ciphertext bytes to a resumable media upload (tus), per `35.10`. |
| `HEAD /v1/media/uploads/{upload_id}` | Query resumable media upload offset and status (tus), per `35.10`. |

Path-embedded protocol identifiers are the base32lower text form, per `10-identifiers.md`. An identifier in a URL MUST be verified to decode to the expected byte length. The tus `upload_id` path component is an opaque upload resource token, per `35.10`.

### Endpoint reference

Each endpoint's authentication, rate group, body limit, idempotency, and primary errors are explicit here. "Instance or account auth" means the request is authenticated per `61` (`61.4` for a federation request, `61.9` for an account's device). "Public" means no authentication.

| Endpoint | Auth | Rate group | Body limit | Idempotency | Primary errors |
| -------- | ---- | ---------- | ---------- | ----------- | -------------- |
| `GET /v1/instance` | Public | `lookup` | none | read-only | none |
| `GET /v1/instance/roles` | Public | `lookup` | none | read-only | none |
| `GET /v1/capabilities` | Public | `lookup` | none | read-only | none |
| `POST /v1/events` | Instance or account | `events` | 8 MiB | dedup by `event_id` (`62.4`) | `E_SIGNATURE_INVALID`, `E_DAG_CYCLE`, `E_DAG_UNROOTED`, `E_MISSING_DEPENDENCY`, `E_MANDATORY_UNKNOWN`, `E_RATE_LIMITED` |
| `GET /v1/events/{event_id}` | Instance or account | `events` | none | read-only | `E_NOT_FOUND` |
| `POST /v1/events:fetch` | Instance or account | `fetch` | 8 MiB | per-`event_id` | per-record `E_NOT_FOUND` |
| `POST /v1/objects` | Instance or account | `objects` | 8 MiB | dedup by `object_id` (`60.5`) | `E_BAD_REQUEST`, `E_MANDATORY_UNKNOWN`, `E_RATE_LIMITED` |
| `GET /v1/objects/{object_id}` | Instance or account; object authorization (`33.5`) | `objects` | none; range responses bounded per media object | read-only | `E_NOT_FOUND`, `E_OBJECT_NOT_AUTHORIZED` |
| `POST /v1/sync` | Instance or account | `events` | 8 MiB per page | cursor-stable resume (`62.5`) | `E_MANDATORY_UNKNOWN`, `E_RATE_LIMITED` |
| `GET /v1/accounts/{account_id}` | Public for public profiles; member otherwise (`13.6`) | `lookup` | none | read-only | `E_NOT_FOUND`, `E_MEMBER_REQUIRED` |
| `GET /v1/members/{account_id}` | Member (`13.6`) | `membership` | none | read-only | `E_MEMBER_REQUIRED`, `E_NOT_FOUND` |
| `POST /v1/device-join-requests` | None; self-asserted (`60.10`) | `device-join` | 8 MiB | none required | `E_BAD_REQUEST`, `E_BANNED`, `E_RATE_LIMITED` |
| `POST /v1/media/uploads` | Account (`61.9`) | `media` | media limit (`82.1`) | per-upload `upload_id`; `Upload-Length` fixed at creation | `E_SUSPENDED`, `E_RATE_LIMITED` |
| `PATCH /v1/media/uploads/{upload_id}` | Account (`61.9`) | `media` | media limit (`82.1`) | tus offset/`upload_id` checks | `E_NOT_FOUND`, `E_SUSPENDED`, `E_RATE_LIMITED` |
| `HEAD /v1/media/uploads/{upload_id}` | Account (`61.9`) | `media` | none | read-only | `E_NOT_FOUND` |

## 60.4 Event submission

`POST /v1/events` accepts a CBOR array of events. Each event is validated independently per `22.5` and `42-identity-and-authorization.md`. The response is a CBOR array of result records:

| Key | Field | Type | Description |
| --- | ----- | ---- | ----------- |
| 0 | `event_id` | bytes(16) | The submitted event's id. |
| 1 | `status` | uint | `0` accepted, `1` duplicate, `2` rejected. |
| 2 | `error` | error_object | Present when `status` is `2`, per `80-errors.md`. |

Submitting events that the sender is not authorized to relay is subject to the sender's federation policy and the requirement that the sender prove its instance identity. The receiving instance MUST apply its `61.5` acceptance steps before storing.

## 60.5 Object submission

`POST /v1/objects` accepts a CBOR array of object submissions with the same response shape as `60.4` (`object_id` instead of `event_id`). An object submission is either a complete encrypted object envelope or, for account-authenticated media creation only, a `media_upload_submission` wrapper defined in `35.10`. A receiving instance MUST NOT decrypt objects; it verifies the envelope structure, keys, and authenticated metadata per `33-object-envelope.md`, then stores or forwards per `65-object-storage.md`. Unreadable ciphertext is never a protocol error, per `33.9`.

For account-authenticated media creation, `media_upload_submission` carries a media envelope with `ciphertext` empty and an `upload_id` naming a finalized upload owned by the submitting account. The receiving instance MUST bind that upload's bytes as `ciphertext` before storing. A `media_upload_submission` on an instance-authenticated request MUST be rejected (`E_BAD_REQUEST`), because uploads are account-local and not federated.

For instance-authenticated relay, replication, and synchronization, a media submission MUST be the complete object envelope with the full stream blob in `ciphertext`. A complete media object remains valid on `POST /v1/objects`; the resumable upload wrapper is only the account-to-home-instance creation path.

## 60.6 Retrieval

* `GET /v1/events/{event_id}` returns the event bytes, or `404` with error code `E_NOT_FOUND` (`80-errors.md`).
* `GET /v1/objects/{object_id}` returns the object bytes, or `404` with `E_NOT_FOUND`. For media objects the endpoint MUST support single-range byte-range requests (`Range`, `Accept-Ranges: bytes`) per `35.11`.
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

`GET /v1/accounts/{account_id}` returns no more than the lookup data of `13.6`. For an account with a public profile (`51.5`) the endpoint is public and requires no authentication. Otherwise the requester MUST be a member of the receiving instance, and a non-member request is answered as if the account does not exist (`E_NOT_FOUND`, `91-privacy.md`). When the requester has an active block on the target account (`50.5`), the response contains only the `blocked` marker and MUST NOT include any other account data. Response map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `account_id` | bytes(32) | yes | |
| 1 | `identity_public_key` | bytes(32) | yes | |
| 2 | `handle` | text | yes | Canonical handle per `11.5`. |
| 3 | `home_instance` | bytes(32) | yes | |
| 4 | `device_summary` | array&lt;device_summary&gt; | yes | Bounded device summary, per `82-limits-and-validation.md` |
| 5 | `state` | uint | yes | `0` active, `1` deleted, per `40.4`. |
| 6 | `profile_is_public` | bool | yes | Whether the account publishes a public profile (`51.5`). |
| 7 | `public_profile` | map | no | The public profile card (`51.5`). Present exactly when `profile_is_public` is `true`. |
| 8 | `blocked` | bool | no | `true` when the requester has blocked the target account (`50.5`). When present and `true`, the response contains only this key. |
| 9 | `roles` | array&lt;text&gt; | no | Local staff roles of the target account on this instance (`13.10`), values `moderator` or `administrator`. |

### device_summary

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `device_id` | bytes(16) | yes | |
| 1 | `trusted` | bool | yes | Whether this device is currently trusted. |
| 2 | `kind` | uint | yes | Device kind per `12.5`. |

The device summary MUST NOT include revoked devices, complete history, or private key material.

### public_profile

The public profile card, present only for public accounts:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `display_name` | text | no | |
| 1 | `bio` | text | no | |
| 2 | `pronouns` | text | no | |

## 60.9 Limits

Endpoint-level limits are defined in `82-limits-and-validation.md`. Error conditions follow `80-errors.md`. Retryable failures are indicated by the `retryable` flag in the error object; clients and instances MUST respect it and MUST NOT assume immediate re-delivery.

## 60.10 Device join requests

`POST /v1/device-join-requests` lets a new device present its public keys to the account's home instance before it is authorized, so that the account's trusted device can be prompted to approve it. The endpoint is not authenticated with Loopable signatures, because the device is not yet authorized; the presented keys are self-asserted. Request body:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `account_id` | bytes(32) | yes | The account the device claims to belong to. |
| 1 | `device_id` | bytes(16) | yes | The device's random identifier, per `10.4`. |
| 2 | `signing_public_key` | bytes(32) | yes | The device's Ed25519 public key. |
| 3 | `encryption_public_key` | bytes(32) | yes | The device's X25519 public key. |
| 4 | `device_kind` | uint | yes | Per `12.5`. |
| 5 | `display_name` | text | no | Optional display name shown in the approval prompt. |

The receiving instance MUST validate the structure, MUST reject a request whose `account_id` it does not host, and SHOULD store the request as pending with a bounded lifetime (`82.1`).

The instance MUST notify the account's trusted device of a pending request (notification kind `device_join_request`, per `72.2`), and the trusted device shows an approval prompt showing the presented keys. Approval is the trusted device signing `DEVICE_AUTHORIZED` (`34.4`); the instance MUST NOT authorize a device without that signed event. Declining or ignoring the prompt produces no event; the pending request expires per `82.1`.

This flow is the protocol-enabled approval path for a user logging into a new device. Instances SHOULD require a pending join request before accepting a `DEVICE_AUTHORIZED` event, and SHOULD rate-limit requests per `82.4`.
