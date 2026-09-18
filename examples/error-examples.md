# Example: canonical error responses

Error objects are CBOR maps with the registered code plus optional fields (`spec/80-errors.md`). Bodies that are not well-formed CBOR also produce these codes over HTTP with `Content-Type: application/octet-stream`.

## Signature failure

```text
HTTP/1.1 400
body:
{
  0: "E_SIGNATURE_INVALID",
  1: "signature did not verify for this event",
  2: <request_id>,
  3: false,
  4: {}
}
```

## Replay

```text
HTTP/1.1 400
{
  0: "E_REPLAY",
  1: "request ID already seen within replay window",
  ...
  3: false
}
```

## Missing dependency in a page

```text
HTTP/1.1 422
{
  0: "E_MISSING_DEPENDENCY",
  1: "event references unknown predecessor; use /v1/events:fetch",
  ...
  3: true       ; safe to retry after fetching the missing event
}
```

## Invalid first-device authorization

```text
HTTP/1.1 422
{
  0: "E_FIRST_DEVICE_INVALID",
  1: "first-device authorization missing or inconsistent",
  2: <request_id>,
  3: false,
  4: {}
}
```

## Trust conflict

```text
HTTP/1.1 422
{
  0: "E_TRUST_CONFLICT",
  1: "account already has a genesis device",
  2: <request_id>,
  3: false
}
```

## Rate limit

```text
HTTP/1.1 429
{
  0: "E_RATE_LIMITED",
  1: "too many submissions",
  2: <request_id>,
  3: true,
  4: {0: 1759632000}   ; details: retry_after timestamp
}
```

Retryable status is only informational: `E_REPLAY`, `E_RATE_LIMITED`, and `E_INTERNAL` are never retried blindly; the caller must inspect the code and message.