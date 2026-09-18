# Example: account creation to post submission

This example walks one account from genesis through publishing a post.

## Cast

* Alice: new account with identity key `K_alice_pub`.
* `instance.social` (instance id `INS_a`): Alice's home instance.
* Client device `dv_alpha` on Alice's laptop.

## 1. Account creation

Alice generates an Ed25519 identity key pair. Her account ID is derived (`spec/10-identifiers.md` 10.5):

```text
account_id = SHA-256( "loopable-account-id" 0x00 || K_alice_pub )
account_id = 8f8f6f... (32 bytes)
base32(lower, no padding): 8p12p5gm4n9t6kx2y3j5qpvf7d4x8r1y
```

Her home instance derives the same value and confirms it matches at `POST /v1/events`.

## 2. ACCOUNT_CREATED event

Alice's client `dv_alpha` generates an Ed25519 signing key `S_dv`, an X25519 encryption key `E_dv`, and a random 16-byte `device_id` (`spec/10-identifiers.md` 10.4). Alice signs a first-device authorization with her identity key (`spec/22-signatures.md` 22.9):

```text
first_device_authorization:
  0 authorization_version       : "0.1"
  1 account_id                  : 8f8f6f... (32 bytes)
  2 device_id                   : dv_alpha (16 random bytes)
  3 device_signing_public_key   : S_dv (32 bytes)
  4 device_encryption_public_key: E_dv (32 bytes)
  5 device_kind                 : 0  (client)
  6 identity_signature          : sig( "loopable-first-device-authorization-v1" 0x00
                                        || CBOR(keys 0..5) )
```

Alice assembles and identity-signs `ACCOUNT_CREATED`:

```text
envelope keys:
 0 protocol_version : "0.1"
 1 event_id         : e7572ecb... (16 bytes)
 2 event_type       : 0  (ACCOUNT_CREATED)
 3 account_id       : 8f8f6f... (32 bytes)
 4 device_id        : (empty; genesis, spec 34.3)
 5 created_at       : 1759632400
 6 predecessors     : []
 7 references       : []
 8 body             : {
                       0: K_alice_pub (32 bytes),
                       1: "alice",
                       2: INS_a (32 bytes),
                       3: first_device_authorization (above),
                      }
 9 signature        : sig( "loopable-event-v1" 0x00 || CBOR(keys 0..8) )
```

## 3. First device authorization

Alice's home instance verifies the identity derivation and the event signature, then validates the first-device authorization (`spec/34-event-types.md` 34.3):

* `account_id` matches the envelope and is derived from `K_alice_pub`;
* `device_kind` is not `1` (backup);
* the identity signature over the authorization record verifies under `K_alice_pub`.

Every validator can establish `dv_alpha` as the account's first trusted device from protocol data alone, without trusting the instance (`spec/42-identity-and-authorization.md` 42.5). The instance indexes the username `alice` as reserved at her home instance and accepts the event.

`dv_alpha` is now the trusted device and signs ordinary account events directly. No separate `DEVICE_AUTHORIZED` event is needed for the first device.

## 4. Post object

Alice writes a post. The client encrypts per `spec/23-encryption.md`:

```text
plaintext  : {"0":"Hello from Alice"}
object_id  : pk57q1... (32 bytes, random)
version_id : xv33n8... (32 bytes)
cek        : random 32 bytes
nonce      : 01db0c... (12 bytes)
recipient_key_descriptor (canonical CBOR):
             {0:0, 1:alice_account_id, 2:dv_alpha, 3:E_dv}
recipient_key_id = first 16 bytes of SHA-256(
             "loopable-recipient-key-id-v1" 0x00 || CBOR(descriptor))
             = b6qt2m... (16 bytes)
AAD        : "loopable-object-v1" 0x00 || canonical CBOR of
             {0:"0.1", 1:object_id, 2:0 (post), 3:0 (suite), 4:version_id}
             (spec 23.4)
ciphertext : AES-256-GCM(cek, nonce, AAD, plaintext) = ct || tag(16)

recipient record (device kind):
  0 kind              : 0
  1 account_id        : Alice's account_id
  2 device_id         : dv_alpha
  3 recipient_key_id  : b6qt2m...
  4 encapsulated_key  : via HPKE to E_dv
                       info = "loopable-hpke-object-key-v1" 0x00
                              || object_id (32 bytes)
                              || recipient_key_id (16 bytes)
                              || "0.1" (spec 24.5)
  5 wrapped_key       : HPKE seal of the CEK
```

Envelope (`spec/33-object-envelope.md`):

```text
 0 protocol_version : "0.1"
 1 object_id        : pk57q1...
 2 object_type      : 0  (post)
 3 encryption_suite : 0  (AES-256-GCM)
 4 version_id       : xv33n8...
 5 nonce            : 01db0c...
 6 ciphertext       : ct || tag
 7 recipients       : [ {0:0, 1:alice_account, 2:dv_alpha, 3:b6qt2m...,
                          4:encap, 5:wrapped} ]
 8 metadata         : absent
```

There is no envelope-level key identifier; the recipient record carries `recipient_key_id` per `spec/24-hpke.md` 24.6. The derived `envelope_id` may be computed from the complete envelope for caching or deduplication (`spec/33-object-envelope.md` 33.3).


The client also computes `plaintext_sha256` for later content integrity checks if the post includes media; for this text-only post it is optional.

## 5. POST_CREATED event (empty body)

```text
 enqueue POST_CREATED(13) from dv_alpha:
  0 protocol_version : "0.1"
  1 event_id        : 9c3ab7f1...
  2 event_type      : 13
  3 account_id      : Alice
  4 device_id       : dv_alpha
  5 created_at      : 1759633100
  6 predecessors    : [e7572ecb...]   (the ACCOUNT_CREATED event)
  7 references      : [
                       {0: pk57q1..., 1: xv33n8...}   (object_id, version_id)
                     ]
  8 body            : {}
  9 signature       : sig( "loopable-event-v1" … )
```

## 6. Submission and flow

Alice's client submits the object first, then the event, over authenticated instance channels (`spec/60-federation.md`):

```text
POST /v1/objects           -> {device deliveries handled internally}
POST /v1/events            -> {envelope keys 0..9}
```

The object is delivered to local authorized devices. The event enters the DAG with predecessor `e7572ecb`. Other accounts that follow Alice are:

* notified of the event via `spec/72-notifications.md`;
* able to fetch the object but decrypt it only with a shared key recipient record (`spec/50.3`), per their authorization level.

## 7. What a follower sees

A follower's device holds no recipient record for this object unless it was added explicitly (e.g., when Alice grants decryption). Without it, the post is present but not decryptable (`DECRYPTABLE` is false; `spec/100.2`). Nothing in the protocol reveals the plaintext to the follower's instance.