# 91. Privacy

This module is the authoritative statement of privacy boundaries and metadata handling.

## 91.1 Privacy boundary

The core privacy boundary is:

```text
User/device
    |
    | plaintext + private keys
    v
Client

    |
    | ciphertext + authenticated events
    v
Instance

    |
    | ciphertext + authenticated events
    v
Federated instance
```

Plaintext MUST remain at the client unless a future protocol extension explicitly defines an exception. The official implementation MUST NOT require server-side plaintext decryption merely because a feature is easier that way; a feature that cannot exist without server-side plaintext MUST be redesigned or classified as `INSTANCE_PLAINTEXT_REQUIRED`, per `90.8`.

## 91.2 Metadata minimization

Loopable does not guarantee complete metadata privacy. Instances may observe network connections, request timing, object sizes, storage operations, federation relationships, IP addresses at the transport layer, the protocol version, and the account and instance routing metadata required for operation.

Implementations SHOULD minimize retention of such metadata and MUST NOT expose metadata merely because it is convenient if the protocol does not require it.

## 91.3 What an instance can know

Depending on deployment, an instance may know that an account exists locally, account routing information, membership state required for operation, network addresses, federation peers, request timing, object sizes, object IDs, event IDs, event signatures, encrypted metadata, and storage usage. The protocol's goal is to prevent this operational visibility from becoming automatic plaintext access.

## 91.4 What an instance must not be able to do

Without compromising authorized user devices, an instance MUST NOT be able to: derive an account identity private key; derive a device private key; decrypt arbitrary private posts, messages, or profile data; forge an account event; authorize a new account device; silently replace an account identity; or manufacture a valid user signature.

## 91.5 Storage privacy

Instances SHOULD encrypt their own databases and storage volumes. Disk encryption protects against physical storage theft; Loopable end-to-end encryption protects against unauthorized logical access to plaintext. Both are useful and independent (`65.9`).

## 91.6 Follower and following privacy

Follower and following lists are served only under `50.4`. Counts MAY be visible where the profile is visible; the identities in the lists are separately protected.

## 91.7 No global directory

There is no protocol-level global public user directory, global account execution, or unrestricted search (`71-search.md`, `13.7`). Profile visibility is scoped by context (`51.3`), preventing an accidental global directory from emerging.

## 91.8 Notifications

Notifications MUST NOT expose plaintext content the recipient is not authorized to decrypt, per `72.3`.

## 91.9 Retention

Instances MAY apply local retention policies per `65.7`. Retention MUST NOT modify event or object contents, and MUST be applied conservatively to metadata, per `91.2`.