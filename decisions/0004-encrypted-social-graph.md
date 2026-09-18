# 0004: The social graph is signed events

* Status: accepted
* Basis: `spec/50-social-relationships.md` 50.3; earlier text about the social graph was mutually contradictory.

## Context

Earlier text required the social graph to be encrypted while also requiring instances to serve follow/block events to federation and to make following state visible. A fully encrypted graph cannot be served by instances in the required way.

## Alternatives

1. Encrypt the entire graph: instances store only ciphertext. Rejected, because it contradicts the "signed, visible" follow-model.
2. Make the graph fully visible even to followers of followers. Rejected on privacy grounds.
3. Keep the graph as signed, app-visible events, and confine encryption to the *labels and annotations* attached to a relationship. Chosen.

## Decision

Following and blocking are signed events (visible to the account's instances and holder), and their encrypted `relationship` objects carry only private metadata (labels, annotations) decodable by the target; they do not affect the graph itself.

## Consequences

The signed-graph reading is confirmed: following and blocking are signed, app-visible events, and encryption is confined to private `relationship` object metadata (`spec/50-social-relationships.md` 50.3). The relationship event test vectors assume this reading (`test-vectors/relationship-events.json`).

* Follow state is not secret from the user's own instances or from other holders of relationship object recipient records.
* The privacy story for "who I follow" is weaker than a fully encrypted graph.
* No change to the wire schema is needed if the working group later tightens this: the relationship object gains recipients only for trusted contacts, and the signed graph stays.