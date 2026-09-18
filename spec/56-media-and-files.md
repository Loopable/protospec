# 56. Media and files

This module defines encrypted media objects.

## 56.1 Media objects

Images, videos, files, and other binary content are encrypted objects of object type `3` (`media`). The plaintext media MUST be encrypted before it is uploaded for persistent storage, per `23-encryption.md`.

The plaintext media content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `media_type` | text | yes | IANA media type (MIME), lowercase. |
| 1 | `byte_length` | uint | yes | Length of the plaintext payload in bytes. |
| 2 | `plaintext_sha256` | bytes(32) | yes | SHA-256 of the plaintext payload. |
| 3 | `filename` | text | no | Original filename if any. |
| 4 | `width` | uint | no | Pixel width, for raster media. |
| 5 | `height` | uint | no | Pixel height, for raster media. |
| 6 | `duration_ms` | uint | no | Duration in milliseconds, for timed media. |

Every media object MUST have an object ID, media type, byte length, encrypted payload, encryption metadata, and integrity information. Integrity is provided by both the AES-GCM authentication tag (`23-encryption.md`) and `plaintext_sha256`.

## 56.2 Encryption and transport

The encrypted payload MAY be large. The object envelope is identical to every other object (`33-object-envelope.md`). Authenticated ciphertext MUST NOT be split or streamed in a way that loses tag coverage; if an implementation streams, it MUST still authenticate the full payload before presenting it.

## 56.3 Metadata minimization

Media metadata MUST be minimized:

1. Sensitive metadata (location, camera identity, device metadata) SHOULD be removed from the plaintext media file before encryption when practical.
2. The unauthenticated envelope `metadata` map (`33.6`) MUST NOT carry plaintext excerpt or thumbnail content, and SHOULD carry only routing aids such as a content length.
3. Implementations SHOULD strip metadata from image and video files on upload.

## 56.4 Referencing media

Posts, replies, profiles, and messages reference media through `object_references` (`32.2`). The reference does not grant access; access is decided by the media object's own recipient records.

## 56.5 Retrieval

Instances store and synchronize media like any object, per `65-object-storage.md`. A receiver re-encrypts nothing; it fetches the ciphertext, validates the envelope, recovers the CEK per `24-hpke.md`, and authenticates the payload before decrypting.