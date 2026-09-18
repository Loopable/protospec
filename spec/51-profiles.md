# 51. Profiles

This module defines profiles as encrypted objects and profile visibility.

## 51.1 Profile objects

A profile is an encrypted object of object type `2` (`profile`), per `33.7`. There is no plaintext public-profile category. Every profile payload is encrypted with AES-256-GCM and wrapped per `24-hpke.md` for its authorized recipients. An account MAY additionally elect a public profile (`51.5`), which publishes a plaintext public profile card as account metadata; the profile object itself remains encrypted.

The plaintext profile content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `display_name` | text | no | Display name. |
| 1 | `bio` | text | no | Biography text. |
| 2 | `avatar` | object_reference | no | Reference to a `media` object used as avatar. |
| 3 | `banner` | object_reference | no | Reference to a banner `media` object. |
| 4 | `pronouns` | text | no | Free-form pronoun text; the protocol does not define a fixed list. |

The account username and handle are NOT profile payload; they live in account state per `11.4` and are served through account lookup per `13.6`.

## 51.2 Publishing

A profile change MUST be a `PROFILE_UPDATED` event plus a new encrypted profile object version, per `34.10` and `55-content.md`. The previous profile version remains immutable.

## 51.3 Profile visibility

To view a user's profile, the viewer MUST belong to an instance context that permits access to that account, per `53-contexts-and-membership.md`.

A user outside that context MUST NOT automatically discover the account. The client SHOULD behave as though the account does not exist.

This requirement prevents a global user directory from emerging accidentally through ordinary profile requests. Instances MUST apply the account-lookup and enumeration rules of `13.6` and rate limiting per `82-limits-and-validation.md`.

## 51.4 Authorization

The recipient set of a profile object's key envelope is decided by the account. Senders SHOULD include at least the accounts that shared contexts with the subject at the time of publication. A profile object MUST be included in the recipients of `PROFILE_UPDATED` events; the profile object MUST be retrievable by any viewer to whom the profile is visible per `51.3`.

When the audience of a profile changes, a new profile version with a new recipient set MUST be published, per `55-content.md`.

## 51.5 Public profiles

By default a profile is private and visible only under the context rules of `51.3`. An account MAY elect a public profile by issuing `PROFILE_VISIBILITY_SET` (`34.13`). A public profile is individually lookupable by any client of any instance, with no membership requirement, per `13.6`.

Publicity is not a plaintext-content mode (`00`, `23.1`). The profile object stays an encrypted object. Publicity is expressed through the public profile card, which is plaintext account metadata:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `display_name` | text | no | Display name. |
| 1 | `bio` | text | no | Biography text. |
| 2 | `pronouns` | text | no | Free-form pronoun text. |

The card carries text fields only. Media references such as avatar and banner are encrypted objects whose audience is chosen by the account (`51.4`); they are not part of the card, and a viewer outside that audience cannot decrypt them.

The card is derived from the latest `PROFILE_UPDATED` event while the account is public (`34.10`). Instances resolve it from the account's authoritative event state (`42.2`) and serve it through account lookup (`13.6`, `60.8`). The publishing client SHOULD keep the card fields consistent with the encrypted profile payload; they are two representations of the same profile.

Electing, updating, or withdrawing a public profile MUST each be a new `PROFILE_VISIBILITY_SET` event. A private account MUST NOT have its card served; its lookup requires membership, per `13.6`. After account deletion (`40.4`), lookup returns the deleted state and the card is no longer served.

Publicity does not create enumeration rights: public accounts are individually lookupable but are not listed in any search or directory, per `71-search.md` and `13.7`. A requester who has blocked the account (`50.5`) receives only the `blocked` marker, never the card (`60.8`).