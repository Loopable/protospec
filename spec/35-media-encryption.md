# 35. Media encryption and resumable upload

This module defines the streaming encryption mode used by media objects and the transport for uploading and retrieving large encrypted blobs.

## 35.1 Scope

Media objects (object type `3`) may contain plaintext up to 2 GiB (`82.1`). Encrypting a payload that large in a single AES-256-GCM operation is impractical because the whole ciphertext must be buffered and authenticated at once. Media objects therefore use a segmented authenticated-encryption mode: `encryption_suite` `1` (AES-256-GCM-HKDF Streaming AEAD). It is embedded in the same object envelope as every other object, so federation, storage, synchronization, and recipient key wrapping in `24-hpke.md` are unchanged.

The construction follows the streaming AEAD called `AesGcmHkdfStreaming` in Google Tink, defined in its specification for AES-GCM-HKDF Streaming keys, and analyzed in HS20 (eprint 2020/1019). Loopable fixes the AES-256 variant and one segment size. Implementations MAY use Tink or any other library implementing the same construction. The exact byte layout below is normative; compatibility with Tink's wire format is required.

This module does not change the algorithm for non-media objects, which continue to use `encryption_suite` `0` per `23-encryption.md`.

## 35.2 Parameters

| Parameter | Value |
| --------- | ----- |
| Algorithm | AES-256-GCM-HKDF Streaming AEAD (segmented AES-256-GCM with per-segment derived key) |
| Content-encryption key (CEK) | 256 bits (32 bytes), per `23.2` |
| HKDF | SHA-256, per `20.6` |
| Salt length | 256 bits (32 bytes) |
| Nonce prefix length | 7 bytes |
| Stream header length | 40 bytes |
| Ciphertext segment size | 1 MiB = 1,048,576 bytes |
| Plaintext capacity of first segment | 1,048,520 bytes |
| Plaintext capacity of later segments | 1,048,560 bytes |
| Max plaintext | 2 GiB (`82.1`), 2^32 segments max |
| Encryption suite | `1` |

## 35.3 Stream layout

The ciphertext blob stored in the envelope `ciphertext` field is:

```text
Header || C_0 || C_1 || ... || C_{n-1}
```

`Header` is exactly 40 bytes:

| Offset | Size | Content |
| ------ | ---- | ------- |
| 0 | 1 | Header length, always `0x28` (40) |
| 1 | 32 | `salt`, fresh random bytes |
| 33 | 7 | `nonce_prefix`, fresh random bytes |

`salt` and `nonce_prefix` MUST be generated with a cryptographically secure random source (`20.11`) and MUST be fresh for every encryption of every plaintext.

## 35.4 Key derivation

One derived key authenticates and encrypts every segment:

```text
derived_key = HKDF-SHA256(
    ikm = CEK,
    salt = salt,
    info = AAD,           ; the object AAD of 23.4
    length = 32 bytes)
```

The associated data of `23-encryption.md` `23.4` is the authoritative definition and is used here unchanged. Binding the AAD through the HKDF info ties the entire stream to `protocol_version`, `object_id`, `object_type`, `encryption_suite`, and `version_id`. Tink-compatible implementations that accept an "associated data" argument pass this same `AAD` as the associated data of the stream.

## 35.5 Segmentation and segment encryption

The plaintext is split into segments `M_0 ... M_{n-1}`:

* The first segment holds up to 1,048,520 bytes of plaintext (ciphertext segment size minus header length minus tag).
* Every later non-final segment holds up to 1,048,560 bytes.
* The final segment holds the remainder; if the whole plaintext fits in the first segment, there is exactly one segment.
* When there is more than one segment, all but the final segment hold their maximum length.

Encrypt each segment with AES-256-GCM using `derived_key`, the 12-byte nonce below, and empty associated data:

```text
nonce = nonce_prefix || uint32be(segment_index) || final_byte
```

where `uint32be(segment_index)` is the zero-based segment number in 4-byte big-endian order, and `final_byte` is `0x00` for every segment except the last, which uses `0x01`.

`C_i` is the output of AES-256-GCM given that nonce and key, that is the segment ciphertext followed by the 16-byte tag. The final segment is marked by the `final_byte`; a ciphertext whose last segment is not marked is structurally invalid.

## 35.6 Ciphertext byte offsets

The segment size and header length are chosen so ciphertext segments align to 1 MiB boundaries after the header. With `S = 1,048,576`:

| Segment | Stream offset | Ciphertext size |
| ------- | ------------- | --------------- |
| Header | 0 | 40 |
| `C_0` | 40 | `len(M_0) + 16` |
| `C_i`, i >= 1 | `i * S` | `len(M_i) + 16` |

For a full-stream non-final segment, ciphertext size is exactly `S`. The blob length for an `n`-segment stream is:

```text
len(blob) = 40 + (len(M_0) + 16) + sum_{i=1}^{n-1} (len(M_i) + 16)
```

## 35.7 Decryption and random access

To decrypt segment `i` an implementation needs only the header byte range, the derived key, and the ciphertext bytes of segment `i`. Segments can therefore be decrypted independently and out of order, which is required for streaming playback and range requests.

An implementation decrypting the whole stream MUST:

1. Read `Header` (40 bytes) to obtain `salt` and `nonce_prefix`.
2. Derive `derived_key` per `35.4` from the recovering `CEK` (`24.7`).
3. For each segment, verify its structure, nonce, and 16-byte tag before presenting plaintext.
4. Present plaintext only after every presented segment has authenticated.

Plaintext segments are never exposed as protocol objects. A segment has no identifier, no recipient records, and no retrieval endpoint of its own; segments exist only inside the media object's ciphertext blob. Authors MUST NOT expose segments through any other mechanism.

## 35.8 Truncation, rollback, and integrity

The streaming mode provides integrity at two levels.

* Per-segment authenticity: the `final_byte` marks the last segment, and each segment carries a tag. Truncating the blob removes the marked final segment, which is detected when the stream is read in order.
* Whole-file integrity: the entire plaintext, including the media file bytes in `media_content.data` (`56.1`), is authenticated content. Authenticating every segment of the stream therefore authenticates the whole `media_content` structure and its embedded `data`.

A rollback to an earlier version of a media object is not possible without detection: the `version_id` is part of the AAD, and the plaintext is bound to that AAD through the derived key of `35.4`.

Random-access reads (for example, skipping an MP4 moov box) MAY read only the segments they need; that is safe because each segment authenticates itself. A client that stores or re-uploads the plaintext MUST do so from a stream it has fully authenticated.

## 35.9 Envelope binding

For `encryption_suite = 1` objects:

| Envelope field | Value | Rule |
| -------------- | ----- | ---- |
| `encryption_suite` | `1` | Streaming mode, this module. |
| `nonce` | empty bytes (0 bytes) | The stream carries its own `salt` and `nonce_prefix` in the header. |
| `ciphertext` | the full stream blob | `Header || segments`, per 35.3 through 35.6. |

All other envelope behavior is unchanged (`33-object-envelope.md`): the AAD of `23.4`, the recipient records of `24.6`, the derived `envelope_id`, metadata rules, and storage behavior in `65-object-storage.md`.

`encryption_suite` is chosen when producing the plaintext. Media objects MUST use suite `1`; all other object types MUST use suite `0`. An envelope whose `encryption_suite` does not match its object type is invalid (`E_BAD_REQUEST`).

## 35.10 Resumable upload

Media blobs can be large. Instances MUST support resumable upload of media ciphertext blobs using the tus resumable upload protocol, version 1.0.0 (`https://tus.io`). The uploaded bytes are exactly the envelope `ciphertext` field value described above; the upload length is `len(blob)`.

The resumable upload endpoint group at `/v1/media/uploads*` is registered in `60.3`. The upload resource is transient: it is not an object, is not federated, and is not visible to other instances. An instance stores the blob only until it is bound to an object envelope as described below, or until the resource expires.

The client flow is:

1. Create the media blob locally (metadata stripping per `56.3`, encryption per this module), using the account's own instance as the upload target.
2. Upload the blob to `POST /v1/media/uploads` with `Upload-Length` set to `len(blob)`, and upload bytes with `PATCH` as tus specifies (`creation`, `creation-with-upload`, and single-URI chunking are sufficient; `concat` is not required).
3. Assemble the media object envelope in memory with the blob as its `ciphertext` value.
4. Submit the envelope to `POST /v1/objects` (60.5).

The instance receiving the envelope MAY bind the stored blob from a completed upload identified by `metadata` (`33.6`) rather than stream the bytes a second time; the envelope remains the authoritative protocol object and the submission must still carry complete and valid envelope fields. Instances MUST NOT accept a media envelope that references an unreachable or unfinished upload. Resumable upload is a transport optimization; the interop contract is the envelope.

Media blobs transferred by this endpoint are excluded from the 8 MiB request body limit (`82.1`) and are bounded instead by the media plaintext limit.

## 35.11 Retrieval and byte ranges

`GET /v1/objects/{object_id}?version=` (`60.6`) MUST support single-range byte-range requests (`Range: bytes=` per RFC 9110) for media objects and MUST advertise `Accept-Ranges: bytes`.

A byte-range request over a media object is interpreted over the ciphertext blob bytes defined in `35.3`. The server MAY return the requested range exactly. A client decrypting a range MUST fetch whole ciphertext segments and MUST request a range aligned to segment boundaries: for range `[a, b)` the client MUST request from the start of the segment containing `a` to the end of the segment containing `b`, per the offsets of `35.6`.

A client that reads only part of a media object MUST NOT claim authenticity for the parts it did not read; each presented segment is authenticated individually, and the whole-object guarantee of `35.8` requires the full stream.

## 35.12 Thumbnails and derived media

Thumbnails, previews, transcoded variants, and other derived renderings of a media object are separate encrypted media objects: each is an object type `3` envelope with its own `object_id`, `encryption_suite = 1`, CEK, nonce material, and recipient records. A rendering is never a plaintext fragment of another object and MUST expose no key material of the source media.

A rendering of a media object MAY be referenced from the source media content with `thumbnail_reference` (`56.1`, content key `6`). The reference does not grant access; access to the rendering is decided by its own recipient records, per `56.4`.