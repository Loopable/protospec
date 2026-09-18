# 55. Content

This module defines posts, replies, edits, versioning, conflict resolution, forwarding, and audience changes.

## 55.1 Post objects

A post is an encrypted object of object type `0` (`post`). Its plaintext content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `text` | text | yes | Post text; the empty string is allowed. |
| 1 | `attachments` | array&lt;object_reference&gt; | no | Attached media objects. |
| 2 | `created_locale` | text | no | Informational locale of the author, BCP 47. |

A reply is an encrypted object of object type `1` (`reply`), with the content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `parent` | object_reference | yes | The object (and version) being replied to. |
| 1 | `text` | text | yes | Reply text; the empty string is allowed. |
| 2 | `attachments` | array&lt;object_reference&gt; | no | Attached media objects. |

## 55.2 Publishing

Publishing a post publishes a `POST_CREATED` event (`34.10`) whose `object_references` contains the post object and its `version_id`. The event signs the routing data; the object carries the encrypted payload.

## 55.3 Versioning

Every logical object has an immutable version history. A logical object is identified by its `object_id`; in protocol version 0.1 every object has at least one version, identified by a random 32-byte `version_id` (`10.4`). The object envelope MUST carry that `version_id` (`33.2`).

A version record identifies, inside the version's own encrypted payload or event body where required:

* the logical `object_id`;
* the `version_id`;
* the creating event;
* the predecessor version, via the version reference in `POST_EDITED` (`34.10`);
* the encrypted object;
* the creator account and device;
* the creation timestamp.

A version_id MUST NOT be reused. The original object remains immutable; an edit creates a new version and a new event. Clients MAY display only the current version in normal UI while retaining the cryptographic history required by the protocol.

## 55.4 Edits

An edit creates a new object version and a new event:

```text
POST_CREATED
   |
   v
POST_EDITED
   |
   v
POST_EDITED
```

Each `POST_EDITED` event references the previous version via `previous_version_id`. The new version gets a new `version_id`, a new random CEK and nonce, and new recipient records, per `23-encryption.md` and `24-hpke.md`.

## 55.5 Conflict resolution

Because Loopable uses a DAG rather than a single global chain, concurrent edits are possible. Two edits MAY legitimately reference the same predecessor.

```text
       A
      / \
     B   C
      \ /
       D
```

Implementations MUST NOT silently declare `B` or `C` invalid merely because they are concurrent.

The application-specific object type MUST define its conflict policy:

* For `post`, `reply`, and `direct_message` objects, the policy is: at any causal point the current version is the newest version (by `created_at`) among the versions reachable at that point, with `event_id` as the final deterministic tie-breaker. When two versions are concurrent and neither causally dominates, the client MUST present the conflict state and MAY offer a deterministic merge or let the user choose. The versions remain immutable.
* Where the object type does not define automatic conflict resolution, the client MUST present the conflict state or use the deterministic presentation ordering of `64-conflict-resolution.md`.

## 55.6 Forwarding

When a user forwards an object, the forwarded object is treated as a new logical object:

* a new `object_id`;
* a new encryption key;
* a new event.

The original object's authorization MUST NOT automatically transfer to the forwarded object. Forwarded content is re-encrypted for the forwarder's recipients.

## 55.7 Quotes and replies

A reply or quote MAY reference an earlier object. The reference MUST NOT automatically grant the recipient access to the referenced object. If a client is not authorized to decrypt the referenced object, it MUST treat the reference as unavailable, per `33.9`, and a reply MUST NOT leak plaintext from an inaccessible parent.

## 55.8 Audience changes and public transitions

* Changing an object's audience MUST create a new event.
* The original encrypted object MUST remain immutable.
* Public-to-private and private-to-public transitions MUST NOT merely modify metadata: the content SHOULD be re-encrypted with a new content-encryption key distributed only to the authorized recipients, per `154` of the foundational draft. A new version is created where required.
* Existing private keys MUST NOT be reused as the public distribution mechanism if that would preserve unauthorized access.

## 55.9 Deletion

Deletion of a post is `POST_DELETED` (`34.10`). Deletion MUST NOT mutate the original event; the deletion event is immutable. Instances apply deletion per `65-object-storage.md`. Cryptographic deletion of local keys SHOULD follow, per `90-security.md`.