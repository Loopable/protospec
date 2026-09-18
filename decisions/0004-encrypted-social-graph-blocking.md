# 0004: The social graph is signed events

* Status: blocking
* Basis: `spec/50-social-relationships.md` 50.3; draft sections 57-59 are mutually contradictory.

## Context

The foundational draft says in section 59 that the social graph MUST be encrypted, while sections 57 and 58 require instances to serve follow/block/mute events to federation and to make following state visible. A fully encrypted graph cannot be served by instances in the required way.

## Alternatives

1. Encrypt the entire graph: instances store only ciphertext. Rejected, because it contradicts sections 57-58 and the "signed, visible" follow-model.
2. Make the graph fully visible even to followers of followers. Rejected on privacy grounds.
3. Keep the graph as signed, app-visible events, and confine encryption to the *labels and annotations* attached to a relationship. Chosen.

## Decision

Following, blocking, and muting are signed events (visible to the account's instances and holder), and their encrypted `relationship` objects carry only private metadata (labels, annotations) decodable by the target; they do not affect the graph itself.

## Consequences (MUST be reviewed before 1.0)

* Follow state is not secret from the user's own instances or from other holders of relationship object recipient records.
* The privacy story for "who I follow" is weaker than a fully encrypted graph. The working group must confirm the section-59 requirement is satisfied by this reading or amend it.
* No change to the wire schema is needed if the working group later tightens this: the relationship object gains recipients only for trusted contacts, and the signed graph stays.