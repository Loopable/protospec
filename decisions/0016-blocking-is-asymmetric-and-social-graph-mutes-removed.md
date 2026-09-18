# 0016: Blocking is asymmetric and social-graph mutes are removed

* Status: accepted
* Basis: `spec/50-social-relationships.md` 50.5, `spec/34-event-types.md` 34.2 and 34.9, `spec/60-federation.md` 60.8, `spec/72-notifications.md` 72.5

## Context

The earlier design made blocks symmetric (neither party could see the other) and included social-graph mutes as protocol events. The goals changed: blocks should affect only the blocker's experience, and social-graph-level muting should be a client-side concern outside the base protocol. A separate instance-level moderation mute exists but is not a relationship event.

## Alternatives

1. Asymmetric blocks, no social-graph mute events. Chosen.
2. Keep symmetric blocks and protocol-level mute events. Rejected: symmetric blocks deny the blocked user read access they should have, and protocol mute events tightly couple client-stream preferences into the cryptographic graph.
3. Asymmetric blocks with protocol mute events retained. Rejected: same coupling issue, and the events serve no protocol purpose once muting is a client concern.

## Decision

A `BLOCK_CREATED` event affects only the blocker. The blocker MUST NOT receive the blocked account's objects, notifications, or activity, and a lookup of the blocked account by the blocker returns only `blocked: true` (`60.8`). The blocked account continues to receive the blocker's content normally. An account MUST NOT block itself. `MUTE_CREATED` and `MUTE_REMOVED` (codes 10 and 11) are retired: the social graph carries only following and blocking.

## Consequences

* Blocks are visible only to the person who placed them.
* Instance-level moderation mute (`13.10.3`) is a separate membership power and does not appear as a social-graph relationship event.
* Notification suppression remains: instances MUST NOT deliver blocked-account notifications to the blocker (`72.5`).
* The account lookup response gains an optional `blocked` marker (`60.8`) without adding new events.