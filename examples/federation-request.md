# Example: a signed federation request

This example constructs an instance-to-instance request end to end, exactly as an implementation must.

## Setup

* Sender instance `a.social`, instance id `INS_a`, operational key `OP1` (per the example instance document).
* Receiver instance `b.social`, instance id `INS_b`.
* Sender and receiver already exchanged instance documents and validated their instance IDs and root signatures via trusted sync or the `/v1/instance` endpoint (`spec/13-instances.md`).

## 1. The HTTP request

To find Alice's account on `b.social`:

```text
GET /v1/accounts/8p12p5gm4n9t6kx2y3j5qpvf7d4x8r1y
Host: b.social
Authorization: Loopable v=1;instance=INS_a_text;key=OP1_text;
               request=reqid_base32;ts=1759632000;
               sig=base64url_of_signature
```

`INS_a_text` is base32lower text of `INS_a`; `OP1_text` likewise; `reqid_base32` is a fresh random 16-byte request ID in base32lower. `ts` is the send time as a decimal epoch-second string. The whole header is a single line; line breaks here are for readability.

## 2. The signature input (`spec/61-federation-authentication.md` 61.4)

```text
request_sig_input =
  "loopable-federation-request-v1" 0x00 ||

  "GET" ||
  "\n" ||                      ; method

  "/v1/accounts/8p12p5gm4n9t6kx2y3j5qpvf7d4x8r1y" ||
  "\n" ||                      ; path

  "" ||
  "\n" ||                      ; query (canonical form)

  "b.social" ||
  "\n" ||                      ; host, lowercased (spec 13.5)

  "8p12p5gm4n9t6kx2y3j5qpvf7d4x8r1y" ||
  "\n" ||                      ; account id, base32 text

  INS_a_text || "\n" ||        ; instance id, base32 text
  OP1_text  || "\n" ||         ; key id, base32 text
  reqid_base32 || "\n" ||      ; request id
  "1759632000"
```

The signature is over those exact bytes: the domain-separated label, then each component in the fixed order, with the components named, then the plain text fields.

## 3. The signature

```text
signature = Ed25519_sign( OP1_private, request_sig_input )
header sig = base64url( signature ) (no padding, spec 61.4)
```

## 4. Receiver validation

1. Split the `Authorization` header on `;`, decode `v=1` (only version accepted).
2. `instance=` must equal `b.social`'s stored text ID of `a.social` per its instance document; the op key `key=` must be within its not-before/not-after validity.
3. `ts` must be within `±300` seconds of the receiver clock (`spec/61-federation-authentication.md` 61.7).
4. `request=` must not have been seen within the replay window.
5. Rebuild the signature input the same way from the request it received, verify with the op key.

Any failure yields the specific error code from `spec/80-errors.md`: `E_AUTH_MALFORMED`, `E_AUTH_INVALID`, `E_REPLAY`, or `E_UNAUTHORIZED_INSTANCE`.

## 5. Response

`b.social` responds with the account lookup body (`spec/60-federation.md` 60.8):

```text
200 OK, Content-Type: application/octet-stream
body = deterministic_cbor( {
   0: Alice's account_id,
   1: K_alice_pub,
   2: "alice@b.social",
   3: INS_b,
   4: [ {0: dv_alpha, 1: true, 2: 0} ],
   5: 0,
   6: false
} )
```

Alice's account has not elected a public profile (`spec/51-profiles.md` 51.5), so `profile_is_public` is false and no `public_profile` card is present.

Responses are not signature-required unless they mutate state; state-changing responses are delivered as events instead (`spec/61-federation-authentication.md` 61.8).