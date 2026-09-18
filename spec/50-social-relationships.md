# 50. Social relationships

This module defines the authoritative semantics of following and blocking.

## 50.1 Relationship events

Relationships are represented by immutable signed events:

| Event | Meaning |
| ----- | ------- |
| `FOLLOW_CREATED` | Begin following the target account. |
| `FOLLOW_REMOVED` | Stop following the target account. |
| `BLOCK_CREATED` | Block the target account. |
| `BLOCK_REMOVED` | Unblock the target account. |

All relationship events are signed by an authorized device of the subject account, per `34.9`. There is no social-graph mute event: muting is a client-side preference outside the base protocol, and a separate instance-level moderation mute is defined in `13.10.3`.

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

A block is a unilateral relationship. A user MAY block another user without approval. An account MUST NOT block itself. A block MUST NOT require plaintext disclosure of unrelated social data.

A block is asymmetric. It affects only the blocker:

* The blocker MUST NOT receive the blocked account's objects, notifications, or relationship-derived activity, per `72-notifications.md`.
* A lookup of the blocked account by the blocker MUST NOT return the account's profile or public card: the instance returns only the `blocked` marker (`60.8`, `13.6`).
* The blocked account is unaffected. It continues to receive the blocker's content and may look the blocker up normally. The block is visible only to the blocker.

The block does not change object audiences or recipient records (`33-object-envelope.md`). Unblocking (`BLOCK_REMOVED`) restores normal visibility. A moderator banning an account from an instance is a separate infrastructure-level action, per `13.10.3` and `91-privacy.md`.

## 50.6 Relationship state

A relationship between account `S` (subject) and account `T` (target) has the state: `none`, `following`, or `blocking`. A block and a follow of the same account are mutually exclusive: `BLOCK_CREATED` stops any follow of `T` by `S` and sets the state to `blocking`; `BLOCK_REMOVED` returns the state to `none` (a follow does not automatically resume). Clients MUST NOT infer any entitlement from follower status beyond what the audience and visibility rules allow.