# 80. Errors

This module is the authoritative error registry. Every protocol error has a machine-readable code; human-readable text is not protocol semantics.

## 80.1 Error object

An error response body is a CBOR map:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `error_code` | text | yes | Code from the registry. |
| 1 | `message` | text | yes | Human-readable description; not protocol semantics. |
| 2 | `request_id` | bytes(16) | no | The request id that failed, echoed from authentication. |
| 3 | `retryable` | bool | yes | Whether retrying the operation is appropriate. |
| 4 | `details` | map | no | Structured data defined per code (for example missing predecessor IDs). |

HTTP status codes map as shown in the registry. Clients MUST use `error_code`, never the message text, for logic.

## 80.2 Registry

| Code | HTTP | Retryable | Meaning |
| ---- | ---- | --------- | ------- |
| `E_MALFORMED_ENCODING` | 400 | no | Invalid CBOR, field type, length, duplicate key, or tag (`31.9`). |
| `E_BAD_REQUEST` | 400 | no | Well-formed but invalid request. |
| `E_EVENT_ID_COLLISION` | 400 | no | Event ID already accepted with different bytes (`10.8`). |
| `E_DECRYPTION_FAILED` | 400 | no | AEAD or HPKE authentication failure (`23.5`, `24.7`). |
| `E_SIGNATURE_INVALID` | 401 | no | Ed25519 verification failed (`22.6`). |
| `E_AUTH_MALFORMED` | 401 | no | Malformed Authorization header (`61.5`). |
| `E_AUTH_INVALID` | 401 | no | Authentication identity not established. |
| `E_REPLAY` | 401 | no | Request id reused within the window (`61.7`). |
| `E_TIMESTAMP_OUT_OF_RANGE` | 401 | no | Timestamp outside the freshness window (`61.5`). |
| `E_UNAUTHORIZED_INSTANCE` | 403 | no | Peer not permitted to federate. |
| `E_UNAUTHORIZED_DEVICE` | 403 | no | Signing device not authorized for the operation (`42.4`). |
| `E_FIRST_DEVICE_INVALID` | 422 | no | First-device authorization missing, malformed, or inconsistent with the account identity or device binding (`34.3`). |
| `E_MEMBER_REQUIRED` | 403 | no | Requester is not a member (`13.6`). |
| `E_OBJECT_NOT_AUTHORIZED` | 403 | no | Requester not permitted to receive the served object. |
| `E_NOT_FOUND` | 404 | no | Event, object, or account not found or not served. |
| `E_USERNAME_UNAVAILABLE` | 409 | no | Username not available (`40.2`). |
| `E_DAG_CYCLE` | 422 | no | Event introduces a dependency cycle (`63.1`). |
| `E_DAG_UNROOTED` | 422 | no | Event cannot be connected to its account root (`63.2`). |
| `E_MISSING_DEPENDENCY` | 422 | no | Required predecessor unknown; `details` lists `missing` event IDs (`63.3`). |
| `E_TRUST_CONFLICT` | 422 | no | Ambiguous trusted-device state (`42.3`). |
| `E_MANDATORY_UNKNOWN` | 422 | no | Unknown mandatory event/object/capability (`81.3`). |
| `E_UNSUPPORTED_VERSION` | 426 | no | Unsupported protocol version (`81.2`). |
| `E_UNSUPPORTED_CAPABILITY` | 426 | no | Mandatory capability unsupported (`81.3`). |
| `E_RATE_LIMITED` | 429 | no | Rate limit exceeded (`82.4`). |
| `E_INTERNAL` | 500 | yes | Internal error. |

Codes not in this registry on a version 0.1 wire MUST NOT be assumed meaningful; a decoder that receives an unknown code for a response it triggered MAY treat it as `E_INTERNAL` on its side, but MUST NOT invent new semantics for it.

## 80.3 Usage

* Error responses carry `Content-Type: application/cbor` and the error object as the body.
* `retryable=true` codes MAY be retried with backoff. `retryable=false` MUST NOT be retried without a user or administrative decision.
* Success responses to batch submissions (`60.4`, `60.5`) embed per-item errors using the same codes, with `request_id` omitted since events use `event_id`.