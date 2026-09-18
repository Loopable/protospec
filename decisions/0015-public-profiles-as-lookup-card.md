# 0015: Public profiles are a user-elected plaintext lookup card

* Status: accepted
* Basis: `spec/51-profiles.md` 51.5, `spec/34-event-types.md` 34.13, `spec/13-instances.md` 13.6, `spec/60-federation.md` 60.8

## Context

Users asked for a way to be findable by people who are not in an instance with them, while keeping profiles private by default as they are today. The protocol has no plaintext-content mode (`spec/00-introduction.md` 0.2, `spec/23-encryption.md` 23.1, `spec/33-object-envelope.md` 33.1): every social object, including profiles, MUST be encrypted, and "public" content still distributes decryption keys only to recipients the account chooses. Serving a plaintext profile object would break that invariant.

## Alternatives

1. Serve a limited public "lookup card" as plaintext account metadata inside the existing account-lookup response, readable by anyone; the encrypted profile object and its recipient model go unchanged. Chosen.
2. Keep the profile as one encrypted object and publish its wrapping keys to anyone for public accounts. Rejected: it splits the encryption model into two modes, and every viewer would have to fetch and attempt decryption to render a name.
3. Define an explicit plaintext public-profile object type. Rejected: it reintroduces a plaintext-content lane, against 0.2/23.1/33.1, and duplicates the profile schema.

## Decision

Publicity is an account-level election, private by default, expressed with a new `AUTHORIZED` event `PROFILE_VISIBILITY_SET` (type 25, `spec/34-event-types.md` 34.13). Public accounts publish a plaintext public card (display name, bio, pronouns) derived from the latest `PROFILE_UPDATED`, which the account-lookup endpoint (`13.6`, `60.8`) serves to any client without membership. Absence of the event, or a latest value of `false`, means private lookup exactly as before. Avatar and banner stay encrypted objects and are intentionally not part of the card.

## Consequences

* The no-plaintext-content invariant is preserved. The card is account metadata, like the canonical handle, not a content object, so `spec/00-introduction.md` 0.2 is untouched in effect.
* A public account is individually lookupable by anyone, but gains no enumeration or global-search rights (`13.7`, `71-search.md`, conformance 15).
* `PROFILE_UPDATED` (12) is no longer always empty: while the account is public its body may carry the card fields in plaintext. The event is still signed, so the card is verifiable.
* Instances resolve visibility and the card from the account's authoritative event state (`42.2`); no plaintext profile version exists.
* The version 0.1 card is text-only. Outsiders cannot decrypt media objects such as avatar and banner; a public-media option, if wanted, is a separate later change.