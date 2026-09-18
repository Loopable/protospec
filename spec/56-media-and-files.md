# 56. Media and files

This module defines encrypted media objects.

## 56.1 Media objects

Images, videos, files, and other binary content are encrypted objects of object type `3` (`media`). The plaintext media MUST be encrypted before it is uploaded for persistent storage, per `35-media-encryption.md`.

The plaintext media content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 1 | `media_type` | text | yes | IANA media type (MIME), lowercase. |
| 2 | `filename` | text | no | Original filename if any. |
| 3 | `size` | uint | yes | Length of `data` in bytes; MUST equal `length(data)`. |
| 4 | `data` | bytes | yes | The exact plaintext octets of the media file. |
| 5 | `metadata` | media_metadata | no | Structured metadata such as dimensions, duration, or codec information (`56.1` below). |
| 6 | `thumbnail_reference` | object_reference | no | Reference to a thumbnail rendering of this media object, per `35.12`. |

`media_content.data` contains the exact plaintext octets of the media file. The value MUST NOT be interpreted as UTF-8 text or otherwise transformed by the protocol, and its length MUST equal `media_content.size`. The protocol MUST NOT compress, transcode, convert line endings, convert between character encodings, or otherwise transform `data`.

The `media_metadata` map (content key `5`):

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `width` | uint | no | Pixel width, for raster media. |
| 1 | `height` | uint | no | Pixel height, for raster media. |
| 2 | `duration_ms` | uint | no | Duration in milliseconds, for timed media. |

Every media object MUST have an object ID, media type, plaintext byte count, encrypted payload, encryption metadata, and integrity information. Integrity is provided by the streaming mode's per-segment authentication (`35.7`), which covers the complete canonical `media_content` plaintext including `data`.

## 56.2 Encryption and transport

Media objects use `encryption_suite` `1` (streaming media encryption, `35-media-encryption.md`). The encrypted payload MAY be large. The object envelope is identical to every other object (`33-object-envelope.md`): the envelope's `nonce` is empty and `ciphertext` holds the stream blob. The stream is carried wholly inside the envelope; it is never split across objects or references. Resumable upload and byte-range retrieval are defined in `35.10` and `35.11`.

The encrypted representation MUST encrypt the complete canonical serialized `media_content` plaintext: `data` is a field of that plaintext, not a side channel, and the whole `media_content` is what `size`, the stream segments, and the AAD of `35.4` cover. Encryption segmentation MUST NOT create additional Loopable objects, object versions, or events.

Implementations MUST support streaming serialization and encryption of media payloads and MUST NOT require the complete media payload to be resident in memory simultaneously. The resulting plaintext, ciphertext, and blob MUST be byte-for-byte compatible with the canonical `media_content` serialization defined in `56.1` and the stream layout defined in `35.3`.

## 56.3 Metadata minimization

Media metadata MUST be stripped, not merely tolerated:

1. The uploading client MUST remove embedded metadata from the media file before encrypting it. This includes EXIF and equivalent metadata: GPS coordinates and location data, camera and device identifiers and serial numbers, author/host identity, software signatures, and any embedded thumbnails the file does not need.
2. The client MUST NOT put location coordinates, camera identity, device identity, or other privacy-sensitive fields into the media payload or into the object envelope `metadata` map (`33.6`).
3. The unauthenticated envelope `metadata` map (`33.6`) MUST NOT carry plaintext excerpt or thumbnail content, and SHOULD carry only routing aids such as a content length.
4. Implementations MUST strip metadata from image, video, and other media files on upload. Where format-level stripping is unreliable, implementations SHOULD re-encode the file so no embedded metadata survives.

## 56.4 Referencing media

Posts, replies, profiles, and messages reference media through `object_references` (`32.2`). The reference does not grant access; access is decided by the media object's own recipient records.

## 56.5 Retrieval

Instances store and synchronize media like any object, per `65-object-storage.md`. A receiver re-encrypts nothing; it fetches the ciphertext, validates the envelope, recovers the CEK per `24-hpke.md`, and authenticates the payload before decrypting. Large media blobs MAY be fetched partially with byte-range requests, and uploads MAY use the resumable upload endpoint, per `35.10` and `35.11`.

## 56.6 Thumbnails and derived media

Thumbnails, previews, and other renderings of a media object are separate encrypted media objects with their own recipient records, per `35.12`. A media object references a rendering through content key `6` (`thumbnail_reference`); the reference does not grant access, per `56.4`.