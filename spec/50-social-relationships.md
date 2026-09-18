# 50. Social relationships

This module defines the authoritative semantics of following, blocking, and muting.

## 50.1 Relationship events

Relationships are represented by immutable signed events:

| Event | Meaning |
| ----- | ------- |
| `FOLLOW_CREATED` | Begin following the target account. |
| `FOLLOW_REMOVED` | Stop following the target account. |
| `BLOCK_CREATED` | Block the target account. |
| `BLOCK_REMOVED` | Unblock the target account. |
| `MUTE_CREATED` | Mute the target account. |
| `MUTE_REMOVED` | Unmute the target account. |

All relationship events are signed by an authorized device of the subject account, per `34.9`.

## 50.2 Following

Following is unilateral: a user MAY follow another user without approval. Removing a follow is a separate event.

Following MUST NOT itself grant cryptographic access to private content. Following is a social relationship, not an encryption primitive. An object's audience is decided by its recipients (`33-object-envelope.md`).

## 50.3 Relationship and social graph encryption

The signed relationship events are the authoritative and minimally visible representation of a relationship. They are exchanged, stored, and served by instances because the follower-list visibility rule (`50.4`) requires instances to compute and serve the graph.

Additional private relationship metadata (labels, list membership, notes) MUST be carried in an encrypted `relationship` object (object type 5), referenced by the relationship event when present. Its content schema is:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `labels` | array&lt;text&gt; | no | User-defined labels. |
| 1 | `annotation` | text | no | Free-form private note. |

Instances SHOULD NOT use an encrypted `relationship` object as a source of graph truth. The signed events are the truth.

## 50.4 Follower and following privacy

The protocol defines the following rule, which instances MUST enforce when serving follower and following lists:

> A user may view another user's follower and following lists only if the other user follows the viewer.

In words: viewer `V` may receive the follower or following list of account `A` only when the account that is the subject of the event graph (account `A`) follows `V`. Being followed is not enough: `B` may follow `A` while `A` does not follow `B`, in which case `B` MUST NOT receive `A`'s lists.

Aggregate follower and following counts MAY be visible wherever the profile is visible (`51-profiles.md`). The identities in the lists are separately protected by the rule above.

An instance MUST NOT serve a follower/following list to a viewer that fails this check, and MUST rate-limit repeated requests per `82-limits-and-validation.md`.

## 50.5 Blocks

A block is a unilateral relationship. A user MAY block another user without approval. A block MUST NOT require plaintext disclosure of unrelated social data.

Effects the protocol specifies: implementations MUST NOT deliver the blocker's objects, notifications, or relationship-derived activity to the blocked account, and MUST NOT deliver the blocked account's activity to the blocker, per local policy where federation requires it. Additional instance-level blocking at the infrastructure layer is distinct and allowed, per `65-object-storage.md` and `91-privacy.md`. Protocol-level blocking and instance-level federation blocking are separate concepts.

## 50.6 Mutes

A mute is a client-side preference applied to the muting user's stream. Mutes MUST NOT change object audiences, must not be visible to the target, and MUST NOT be served as a graph relationship to other users. Muting affects the muting client's display and notifications only, per `72-notifications.md`.

## 50.7 Relationship state

A relationship between account `S` (subject) and account `T` (target) has the state: `none`, `following`, `blocking`, `muting`, or combinations such as `following_and_muting`, `blocking_and_muting`. `BLOCK_CREATED` implies any follow of `T` by `S` stops and the combined state is `blocking`. `BLOCK_REMOVED` returns the relationship to `none` (a follow does not automatically resume). Clients MUST NOT infer any entitlement from follower status beyond what the audience and visibility rules allow.