# 65. Object storage

This module is the authoritative definition of object storage, relay, replication, retention, and deletion.

## 65.1 Storage authorization

An instance may store an object if:

* the object was submitted by an authorized participant (an account device authorizing delivery, per `42-identity-and-authorization.md`, or a federated peer per `61-federation-authentication.md`);
* the instance accepts storage according to its local policy;
* federation rules permit the transfer.

Storage authorization is not equivalent to plaintext decryption authorization. An instance may store ciphertext it cannot decrypt, per `23.8` and `33.9`.

The object storage backend SHOULD be an S3-compatible object storage service (`65.10`).

## 65.2 Location independence

Object storage location is independent of account identity location. Any compatible instance MAY store an encrypted object given the storage authorization above. A storage instance does not become the object's cryptographic owner merely by storing it.

## 65.3 Relay

An instance may relay ciphertext without decrypting it. A relay MUST preserve the object ID, ciphertext, encryption metadata, recipient envelopes, and integrity metadata, and MUST NOT modify authenticated ciphertext or any authenticated field of the object envelope, per `33.8`.

## 65.4 Deduplication

Instances MAY deduplicate objects by `object_id`. They MUST NOT assume that equal plaintext implies equal object IDs: object IDs are random and intentionally do not provide plaintext-based deduplication.

## 65.5 Replication and loss

An object MAY be replicated to multiple instances. Replication does not require plaintext access and SHOULD be performed over encrypted objects.

Loopable does not provide a global persistence guarantee. If an object exists only on one instance and that instance permanently disappears, the object may become unavailable. No instance is required to guarantee indefinite object retention. Implementations MAY replicate objects for durability.

## 65.6 Deletion

Deletion is represented by a deletion event (`POST_DELETED`, `GROUP_DELETED`, `ACCOUNT_DELETED`). Semantics:

1. A deletion event MUST reference the object or object version being deleted.
2. Deletion MUST NOT mutate the original event; the deletion event itself is immutable.
3. Instances MUST apply deletion according to the object's authorization and retention rules.
4. Clients SHOULD delete locally stored decryption keys when content is deleted or access is revoked (`cryptographic deletion`).
5. An implementation MUST NOT claim that physical deletion from every replica is guaranteed merely because a deletion event was created.

### Deletion scope

Deletion applies to different artifacts with different effects:

| Artifact | Deleted on deletion event | Physical removal |
| -------- | ------------------------- | ---------------- |
| Object content (plaintext) | NO deletion event carries plaintext; see next rows | Never in-band |
| Object ciphertext (local store) | Instance MAY delete per retention (`65.7`) | Async per policy; not guaranteed network-wide |
| Object replicas and caches | Replicas SHOULD apply the deletion event | Not guaranteed; caches may serve until invalidated |
| Decryption keys (client) | Clients SHOULD delete keys (`cryptographic deletion`) | Client-side |
| Recipient records | New access MUST NOT be granted after revocation | Not guaranteed |
| Events (including the deletion event) | Immutable; never deleted by the deletion event | Retained as protocol evidence (`100-conformance.md`) |
| Media upload blobs (`35.10`) | Deleted when unbound or when the object is deleted | Instance-local; MAY be immediate |

Protocol deletion (the event) and physical deletion (the bytes) are distinct. A deletion event is authoritative state; physical byte removal is best-effort replication-aware behavior.

## 65.7 Retention

Instances MAY apply local retention policies where protocol semantics permit. Retention MUST NOT modify event or object contents. Account deletion events SHOULD trigger deletion of local encrypted objects per policy.

## 65.8 Retrieval

`GET /v1/objects/{object_id}` returns stored objects per `60.6`. An instance MUST NOT serve an object to a requester that is not permitted to receive it under the federation and storage policy. Serving is independent of whether the instance can decrypt the served object.

## 65.9 Disk encryption

Instances SHOULD encrypt their own databases and storage volumes. Disk encryption protects against physical storage theft; Loopable end-to-end encryption protects against unauthorized logical access to plaintext. Both are useful and independent, per `91-privacy.md`.

## 65.10 Storage backend

The persistent store for encrypted objects SHOULD be an S3-compatible object storage service. The instance maps protocol operations directly onto object-store operations:

* **put**: write the encrypted object bytes under a key derived from the `object_id`, with the `version_id` as an additional component where the backend distinguishes versions;
* **get**: read the bytes back by that key;
* **delete**: remove the key, subject to retention (`65.7`).

The object store MUST treat object bytes as opaque ciphertext: it never sees plaintext and never needs it. Bucket access control SHOULD restrict reads and writes to the instance's service identity, and server-side encryption at rest MAY be used.

Using an S3-compatible service is a deployment choice, not a protocol dependency. In-process storage or other backends are acceptable as long as the observable behavior matches `65.1` through `65.8`.