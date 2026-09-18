# 72. Notifications

This module defines notification objects.

## 72.1 Model

Notifications are protocol objects/events. Notification data SHOULD be encrypted. A server SHOULD deliver notification envelopes without requiring plaintext access to their contents. The client decrypts notification information.

## 72.2 Notification object

A notification is an encrypted object of object type `8` (`notification`). Content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `kind` | uint | yes | `0` reply, `1` mention, `2` follow, `3` direct_message, `4` group_removal, `5` other, `6` device_join_request. |
| 1 | `actor_account_id` | bytes(32) | yes | The account that triggered the notification. |
| 2 | `reference` | object_reference | no | The referenced object (replied post, message, etc.). |
| 3 | `text` | text | no | Optional client-presentable summary. |

## 72.3 Privacy

A notification MUST NOT expose plaintext content that the recipient is not authorized to decrypt. An instance MUST NOT need to know that "Alice mentioned Bob in this post" in plaintext to route a notification.

Consequently:

1. The notification object is encrypted for the recipient.
2. The event that references the notification object is signed and routed (`34-event-types.md`); the receiving instance can route without decrypting.
3. A notification's `text` summary, when present, is inside the encrypted payload and the instance does not read it.

## 72.4 Delivery

Delivery is by normal synchronization: the notifying client or the notifying account's device publishes the notification object and a reference event; the recipient's instance synchronizes it per `62-synchronization.md`. Push outside the base protocol is out of scope.

## 72.5 Blocks

Instances MUST NOT deliver notifications for accounts that the recipient has blocked (`50.5`). A mute-like client-side preference is not a protocol concept; accounts suppress or mute content locally outside the base protocol.