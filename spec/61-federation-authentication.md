# 61. Federation authentication

This module is the authoritative definition of how instances authenticate to each other, how federation requests are signed, and how replay is prevented.

## 61.1 Authority model

There are two layers of instance authority:

1. The instance root key (Ed25519), which signs the instance document (`13.3.1`).
2. Operational keys (Ed25519), authorized by the root in the instance document, which sign individual federation requests.

A request is authenticated when its Signer: (a) the claimed instance is identified; (b) the instance's document is obtained and its root signature validates; (c) an operational key in that document is time-valid and matches the request key id; (d) the request signature validates; and (e) the request is fresh and not a replay.

## 61.2 Instance document acquisition

On first contact with a peer, an instance obtains the peer's instance document:

1. Fetch `GET /v1/instance` from the peer's base URL.
2. Verify the document signature over the domain `loopable-instance-document-v1` + the deterministic CBOR of the document without the signature field (`22-signatures.md`).
3. Verify the `instance_id` is derivable from `root_public_key` per `10.5`.
4. Cache the document with its root and operational keys.

Documents MUST be re-fetched when an operational key no longer validates, when the peer reports rotation, or after a configured freshness interval (RECOMMENDED 24 hours). Caching beyond the `not_after` time of every listed operational key is forbidden.

## 61.3 Request signing

Every federated HTTP request (except `GET /v1/instance` and `GET /v1/capabilities`) MUST carry the `Authorization` header:

```text
Authorization: Loopable v=1;instance=<b32 instance_id>;key=<b32 key_id>;request=<b32 request_id>;ts=<decimal seconds>;sig=<base64url signature>
```

The parameters are:

| Parameter | Value |
| --------- | ----- |
| `v` | `1` |
| `instance` | base32lower of the sender's `instance_id` |
| `key` | base32lower of the operational key `key_id` |
| `request` | base32lower of a fresh random 16-byte `request_id` |
| `ts` | Decimal epoch seconds of signing |
| `sig` | base64url of the 64-byte Ed25519 signature |

## 61.4 Signature input

The signature is computed over:

```text
"loopable-federation-request-v1" 0x00 || deterministic_cbor(RequestAuthentication)
```

where `RequestAuthentication` is the map:

| Key | Field | Type | Description |
| --- | ----- | ---- | ----------- |
| 0 | `method` | text | Uppercase HTTP method, e.g. `POST`. |
| 1 | `host` | text | Canonical hostname of the receiving instance per `13.4`. |
| 2 | `path` | text | Canonical request path, per `61.6`. |
| 3 | `query` | text | Canonical query string, per `61.6`; the empty string if none. |
| 4 | `request_id` | bytes(16) | The request identifier. |
| 5 | `timestamp` | uint | Epoch seconds. |
| 6 | `body_hash` | bytes(32) | SHA-256 of the request body bytes; for an empty body, SHA-256 of the empty string. |

The signing key is the operational key selected by `key`. The `host` value is the receiving instance's canonical hostname, which the receiver recomputes from its own configuration.

## 61.5 Verification procedure

A receiving instance MUST verify in order:

1. Parse the `Authorization` header; reject a malformed header with `E_AUTH_MALFORMED`.
2. Identify the claimed `instance_id`.
3. Obtain the instance document (cache or fetch).
4. Verify the document root signature and the derivable `instance_id` per `61.2`.
5. Locate the operational key with the claimed `key_id` in the document; verify it is listed, time-valid (`not_before <= ts <= not_after`), and the `key` id matches.
6. Recompute the canonical request data per `61.4` from the received method, host, path, query, request id, timestamp, and body.
7. Verify the Ed25519 signature over `loopable-federation-request-v1` + the canonical bytes.
8. Verify freshness: `|now - ts| <= 300` seconds.
9. Verify `request_id` has not been observed within the replay window (see `61.7`).
10. Process the request only when all steps succeed.

Failure at any step MUST produce the corresponding error code from `80-errors.md` and MUST NOT process the request.

## 61.6 Canonical path and query

The signed `path` is the URL path beginning with `/`, percent-encoded canonically: uppercase hex escapes normalized to lowercase, and characters outside the unreserved set percent-encoded per RFC 3986. The signed `query` is the query string without the leading `?`, with parameters sorted by name (then by value) and each name and value percent-encoded canonically.

## 61.7 Replay protection

* The freshness window is exactly 300 seconds in both directions.
* A `request_id` MUST NOT be reused by the same sender within the replay window.
* The receiver MUST retain sufficient replay state to detect replayed `request_id` values for the window; retention of 10 minutes or the last 65536 request ids per sender MAY be used.
* Replay of events and objects is separately idempotent via event and object IDs, per `62-synchronization.md`; request-level replay protection prevents abuse of state-changing operations and lookups.

## 61.8 Non-HTTP-TLS relationship

TLS authenticates the transport endpoint; `61.3` to `61.5` authenticate protocol entities. An implementation MUST NOT treat TLS certificate ownership as equivalent to Loopable instance identity. A request that arrives over a valid TLS connection but fails the signature verification MUST be rejected.

## 61.9 Client authentication

Clients authenticate to their home instance with the same scheme: client requests are signed by the client's account device key and identified by the account in the same header plus a `acc` parameter:

```text
Authorization: Loopable v=1;instance=<b32 instance_id>;key=<b32 key_id>;request=<b32 request_id>;ts=<decimal>;acc=<b32 account_id>;sig=<base64url>
```

The signature input is identical to `61.4` with `account_id` bound as an additional field (key 7). The home instance validates the account's device authorization per `42-identity-and-authorization.md` before processing any account-scoped request.