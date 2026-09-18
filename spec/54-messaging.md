# 54. Messaging

This module defines direct messaging and its end-to-end encryption.

## 54.1 Direct messages

A direct message is an encrypted object of object type `4` (`direct_message`), per `33.7`, delivered through the normal encrypted-object pipeline.

The plaintext direct-message content schema:

| Key | Field | Type | Required | Description |
| --- | ----- | ---- | -------- | ----------- |
| 0 | `text` | text | yes | Message text; the empty string is allowed when attachments exist. |
| 1 | `attachments` | array&lt;object_reference&gt; | no | Attached media objects. |

## 54.2 Encryption by conversation shape

* For one-to-one conversations, implementations MAY use per-object encryption with HPKE (`24-hpke.md`): a fresh CEK wrapped to the peer's device X25519 keys.
* For conversations with dynamic membership, implementations MUST use MLS (`25-mls.md`).

The instance MUST NOT require plaintext message access. It stores ciphertext and key envelopes like any other object, per `65-object-storage.md`.

## 54.3 Conversation context

A `MESSAGE_CREATED` event (`34.10`) SHOULD carry a `context` identifier in its body when the message belongs to a conversation with more than one participant. For MLS conversations the context is the first 16 bytes of the MLS `group_id`; for one-to-one conversations the context MAY be a random 16-byte conversation identifier shared by the participants.

Message ordering within a conversation follows the DAG and the deterministic presentation ordering of `64-conflict-resolution.md`.

## 54.4 Delivery and read state

The protocol does not define delivery or read receipts in version 0.1. Receipts, if implemented, are application data carried in encrypted objects and MUST NOT be required for protocol correctness.

## 54.5 Missing conversations

If a participant was not present in a conversation at the time of encryption, they MUST NOT receive a usable key envelope. This is not a protocol error; the client MUST treat the object as unavailable, per `33.9`.