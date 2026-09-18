# 51. Profiles

This module defines profiles as encrypted objects and profile visibility.

## 51.1 Profile objects

A profile is an encrypted object of object type `2` (`profile`), per `33.7`. There is no plaintext public-profile category. Every profile payload is encrypted with AES-256-GCM and wrapped per `24-hpke.md` for its authorized recipients.

The plaintext profile content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `display_name` | text | no | Display name. |
| 1 | `biography` | text | no | Biography text. |
| 2 | `avatar` | object_reference | no | Reference to a `media` object used as avatar. |
| 3 | `banner` | object_reference | no | Reference to a banner `media` object. |
| 4 | `site` | text | no | Optional website URL. |
| 5 | `extra` | map | no | Additional profile fields, application-defined. |

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