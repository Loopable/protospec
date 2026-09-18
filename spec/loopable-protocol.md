# Loopable Protocol Specification

**Protocol name:** Loopable Protocol
**Specification status:** Draft
**Specification version:** 0.1.0
**Document status:** Foundational protocol specification
**Intended audience:** Independent protocol implementers, client developers, instance operators, security reviewers, protocol tooling developers

---

# 1. Scope

This document defines the Loopable Protocol.

Loopable is a decentralized, privacy-first social networking protocol.

The protocol defines:

* account identities
* cryptographic identities
* devices
* device authorization
* device revocation
* usernames
* instances
* instance identities
* instance membership
* profiles
* social relationships
* encrypted objects
* encrypted media
* events
* event signatures
* event dependency graphs
* object encryption
* key distribution
* group encryption
* federation
* synchronization
* missing-event recovery
* object storage
* object deletion
* profile visibility
* follower/following visibility
* account lookup
* instance discovery boundaries
* protocol versioning
* security requirements
* interoperability requirements

The protocol does **not** define:

* a specific official client UI
* a specific database implementation
* a specific object-storage implementation
* a global moderation policy
* a global instance ranking system
* a global public user directory
* a centralized account-recovery mechanism
* a requirement that all instances use the same software
* a requirement that all instances be operated by the Loopable Foundation

The official Loopable implementation is an implementation of this protocol. It is not the protocol itself.

---

# 2. Normative language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as normative requirements.

Where this specification gives an exact algorithm, encoding, field size, validation procedure, or state transition, implementations MUST follow that definition.

Implementations MUST NOT substitute an alternative mechanism merely because it appears functionally equivalent.

Protocol extensions MUST NOT change the meaning of existing fields.

---

# 3. Design principles

Loopable is based on the following principles.

## 3.1 The network should feel unified

A normal user should be able to use Loopable without understanding instances.

The existence of federation MUST NOT require the user interface to expose federation concepts during normal use.

Custom clients MAY expose instance topology.

## 3.2 Instances are infrastructure

An instance provides:

* network connectivity
* federation
* membership management
* encrypted object storage
* synchronization
* local moderation
* rate limiting
* resource management
* account hosting
* protocol endpoints

An instance is not automatically trusted with plaintext user data.

## 3.3 Encryption is mandatory

Loopable does not have a plaintext-content mode.

All Loopable social objects MUST be encrypted before being persisted as protocol objects.

This includes objects that are considered public by their authorization policy.

"Public" therefore means:

> Any authorized Loopable participant satisfying the object's audience policy may obtain the necessary decryption material.

It does not mean:

> The plaintext is stored in the instance database.

## 3.4 Identity and storage are separate

The instance responsible for hosting an account does not have to be the instance storing every object associated with that account.

An encrypted object MAY be stored by any compatible instance that has permission from the relevant protocol context to store or relay it.

## 3.5 Instances are not the cryptographic root of an account

An instance MUST NOT be able to:

* replace an account's identity key
* create an account device
* recover a lost account identity
* forge account activity
* impersonate an account

---

# 4. Terminology

## 4.1 Account

A permanent Loopable cryptographic identity controlled by a user.

## 4.2 Account identity key

The permanent Ed25519 signing key pair associated with an account.

## 4.3 Device

A physical or logically isolated client installation holding its own cryptographic key material.

## 4.4 Trusted device

The one currently trusted device for an account.

An account MUST have exactly one trusted device.

## 4.5 Instance

A network service implementing the Loopable server-side protocol.

An instance has its own cryptographic identity.

## 4.6 Object

An encrypted logical item such as:

* post
* reply
* profile
* media object
* relationship object
* membership object
* message
* group object

## 4.7 Event

An immutable authenticated state transition.

Events reference objects and/or previous events.

## 4.8 Event DAG

The directed acyclic graph formed by event dependency references.

## 4.9 Context

A protocol-defined scope in which accounts may interact and encrypted data may be made available.

An instance is one form of context infrastructure, but instance membership and social-relationship membership are distinct concepts.

## 4.10 Audience

The cryptographically authorized set of recipients of an encrypted object.

## 4.11 Federation

Communication between independent Loopable instances.

---

# 5. Cryptographic requirements

Loopable MUST use established cryptographic primitives.

An implementation MUST NOT invent a new cryptographic primitive or replace a protocol-defined primitive with a proprietary equivalent.

The following algorithms are mandatory for Loopable version 0.1.

---

# 6. Cryptographic algorithm registry

## 6.1 Digital signatures

**Algorithm:** Ed25519

Reference:

RFC 8032.

Ed25519 is used for:

* account identity signatures
* device signatures
* instance identity signatures
* instance operational-key signatures
* protocol authentication signatures

Ed25519 public keys are exactly 32 bytes.

Ed25519 private keys MUST be generated using a cryptographically secure random source.

Private keys MUST never be transmitted unencrypted over the network.

---

# 7. Key agreement

## 7.1 X25519

**Algorithm:** X25519

X25519 is used for:

* HPKE KEM operations
* key agreement where explicitly specified
* device-to-device cryptographic operations where the relevant protocol section specifies X25519

X25519 MUST NOT be used as a signature algorithm.

Ed25519 and X25519 key pairs MUST be treated as separate key types.

An implementation MUST NOT assume that an Ed25519 private key can simply be reused as an X25519 private key.

---

# 8. General symmetric encryption

## 8.1 AES-256-GCM

General Loopable encrypted objects MUST use:

**AES-256-GCM**

Parameters:

* key size: 256 bits
* nonce size: 96 bits
* authentication tag: 128 bits

Every encryption operation MUST use a nonce that is never reused with the same AES-GCM key.

The recommended implementation strategy is:

1. Generate a fresh random 256-bit content-encryption key.
2. Generate a fresh random 96-bit nonce.
3. Encrypt the plaintext using AES-256-GCM.
4. Authenticate the protocol-defined associated data.
5. Store the nonce and ciphertext in the encrypted object envelope.

A content-encryption key MUST NOT be reused between independently encrypted objects unless a specific protocol mechanism explicitly defines key reuse.

A random object key SHOULD be generated using a cryptographically secure random number generator.

---

# 9. HKDF

Where Loopable itself requires a general-purpose key derivation function, it MUST use:

**HKDF-SHA-256**

HKDF MUST be instantiated according to RFC 5869.

Loopable-specific uses of HKDF MUST define:

* input keying material
* salt
* info/context string
* output length
* domain-separation label

Implementations MUST NOT use a single undifferentiated HKDF namespace for unrelated protocol purposes.

Every Loopable-defined HKDF construction MUST use a unique domain-separation label.

---

# 10. HPKE

Loopable uses HPKE as its standard public-key encryption construction where a sender needs to encrypt a secret to one recipient.

HPKE MUST conform to RFC 9180.

The mandatory Loopable HPKE suite for general Loopable public-key encryption is:

```text
KEM:
DHKEM(X25519, HKDF-SHA256)

KDF:
HKDF-SHA256

AEAD:
AES-256-GCM
```

Therefore:

```text
KEM ID  = 0x0020
KDF ID  = 0x0001
AEAD ID = 0x0002
```

The HPKE Base mode MUST be used unless a specific Loopable protocol operation explicitly requires another HPKE mode.

Loopable MUST NOT invent its own replacement for HPKE.

HPKE message encoding MUST explicitly include all values required by RFC 9180 and by the Loopable envelope format.

---

# 11. MLS

Dynamic multi-party encrypted groups MUST use Messaging Layer Security (MLS), RFC 9420.

The mandatory MLS 1.0 cipher suite is:

```text
MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519
```

This means:

* KEM: DHKEM(X25519, HKDF-SHA256)
* MLS KDF: HKDF-SHA256
* AEAD: AES-128-GCM
* hash: SHA-256
* signatures: Ed25519

MLS implementations MUST implement the mandatory MLS 1.0 cipher suite.

Loopable MUST NOT replace MLS's AES-128-GCM with AES-256-GCM inside the MLS cipher suite.

AES-256-GCM applies to Loopable's general object encryption layer.

MLS cryptography remains governed by RFC 9420.

---

# 12. Hashing

Loopable MUST use SHA-256 where a protocol-defined cryptographic hash is required unless another protocol section explicitly specifies a different algorithm.

SHA-256 outputs 32 bytes.

SHA-256 is used for:

* protocol fingerprints
* cryptographic references where specified
* object integrity hashes where specified
* test-vector derivations
* canonicalized protocol metadata hashes

A hash MUST NOT be treated as a secret.

---

# 13. Randomness

All cryptographically random values MUST be generated using a cryptographically secure random number generator appropriate for the host platform.

The following values require cryptographically secure randomness:

* account private keys
* device private keys
* instance private keys
* event IDs
* object encryption keys
* AES-GCM nonces
* HPKE ephemeral keys
* MLS key material
* other protocol-defined random values

An implementation MUST NOT generate security-sensitive random values using:

* timestamps
* sequential counters alone
* predictable pseudorandom generators
* usernames
* hashes of predictable values

---

# 14. Account identity

Every account has one permanent Ed25519 identity key pair.

The account identity public key is the cryptographic root of the account.

Conceptually:

```text
AccountIdentity {
    account_id
    identity_public_key
}
```

`account_id` MUST be deterministically derived from the account identity public key.

The exact derivation is:

```text
account_id = base32lower(
    SHA-256(
        "loopable-account-id\0" ||
        identity_public_key
    )
)
```

The prefix is a domain-separation string.

The resulting identifier MUST use the protocol's canonical lowercase Base32 encoding without padding.

The account identifier therefore does not depend on:

* username
* instance hostname
* device
* email
* password

Changing any of those MUST NOT change the account identifier.

---

# 15. Account handle

A Loopable user-facing canonical handle has the form:

```text
@username:instance.example
```

The local username is the mutable human-readable name.

The instance hostname identifies the account's current home instance.

The canonical cryptographic identity remains the account identity key.

A client MUST NOT use a username alone as an identity.

For example:

```text
@alice:test.org
```

is not cryptographically equivalent to another:

```text
@alice:example.org
```

---

# 16. Username changes

Users MAY change usernames.

A username change MUST be represented by a signed immutable event.

The event MUST cryptographically bind:

* previous username
* new username
* account identity
* effective time
* predecessor event(s)

The old username MUST remain reserved for the account for three months.

The reservation period is exactly:

```text
90 days
```

measured from the effective timestamp of the username change.

During this period, another account MUST NOT claim the old username.

After the reservation expires, the old username MAY be registered by another account.

Once reused, the new account MUST be treated as cryptographically unrelated to the former account.

Clients MUST NOT infer identity continuity from username reuse.

---

# 17. Device identities

Every device has a unique device identifier.

The device identifier MUST be a cryptographically random 128-bit value.

A device has at least:

```text
Device {
    device_id
    device_signing_public_key
    device_encryption_public_key
    authorization
    status
}
```

The exact wire representation is defined by the device schema.

The device signing key is Ed25519.

The device encryption/key-agreement key is X25519.

These keys MUST be generated independently.

---

# 18. Device authorization

A device MUST be authorized by the account's trusted device.

The authorization record MUST be signed by the account identity chain.

Conceptually:

```text
Account Identity
      |
      | authorizes
      v
Device Authorization
      |
      v
Device
```

A device authorization MUST bind:

* account identity
* device ID
* device signing public key
* device encryption public key
* authorization timestamp
* authorization sequence
* issuer device
* authorization signature

A device MUST NOT be considered authorized merely because an instance database says it is authorized.

The client MUST cryptographically validate the authorization chain.

---

# 19. Event signatures

Normal account events MUST be signed by the originating device.

The event MUST contain enough information for a verifier to establish:

1. the event was signed by a device;
2. the device belongs to the claimed account;
3. the device was authorized by the account;
4. the event's signature is valid;
5. the event has not been altered.

The resulting trust relationship is:

```text
Account Identity Key
        |
        | authorizes
        v
Device Key
        |
        | signs
        v
Event
```

The account identity key does not need to sign every ordinary event directly.

---

# 20. Trusted-device model

Exactly one device is trusted at a time.

The trusted device has authority to:

* authorize another device
* revoke another device
* transfer trusted-device status
* modify account-level security state

The instance has none of these authorities.

The instance MAY store and distribute signed authorization events.

It MUST NOT manufacture them.

---

# 21. Device transfer

A device transfer consists of:

1. new device key generation;
2. authorization by the existing trusted device;
3. creation of a device-transfer event;
4. activation of the new trusted device;
5. revocation of the previous trusted device.

Private keys MUST NOT be transferred through the instance.

The old device's private keys MUST NOT be uploaded to the new device through Loopable federation.

---

# 22. Device revocation

Device revocation is represented by an immutable signed event.

The event identifies:

* account
* revoked device
* revoking device
* event ID
* effective sequence
* reason code if applicable

After the revocation becomes effective, implementations MUST reject new account activity signed only by the revoked device.

Previously valid events signed by that device do not become cryptographically invalid merely because the device was later revoked.

---

# 23. Lost trusted device

If the sole trusted device is permanently lost and no previously authorized trusted-device replacement exists, the account is permanently inaccessible.

The protocol MUST NOT provide:

* instance-admin recovery
* support-agent recovery
* email recovery
* password-based cryptographic recovery
* centralized recovery keys
* Foundation recovery

This is deliberate.

An implementation MAY provide user-interface warnings explaining this property.

It MUST NOT silently weaken it.

---

# 24. Instances

An instance is a Loopable protocol server.

An instance has a permanent cryptographic identity.

Instance identity is independent of all account identities.

---

# 25. Instance identity

The instance root identity uses Ed25519.

Conceptually:

```text
InstanceIdentity {
    instance_id
    root_public_key
}
```

The instance identifier MUST be derived from its root public key using:

```text
instance_id = base32lower(
    SHA-256(
        "loopable-instance-id\0" ||
        root_public_key
    )
)
```

The instance identity MUST remain stable across operational-key rotation.

---

# 26. Instance operational keys

The instance root key SHOULD be kept offline or otherwise strongly protected.

The root key authorizes one or more operational federation keys.

Operational federation keys:

* MAY rotate
* MAY be revoked
* SHOULD have limited lifetimes
* MUST be cryptographically linked to the instance root

A compromised operational key therefore does not require changing the instance's permanent identity.

TLS certificates and TLS keys are separate from the Loopable instance identity keys.

---

# 27. Transport security

Federation transport MUST use HTTPS.

TLS 1.3 MUST be supported.

TLS 1.2 MAY be supported for compatibility only where explicitly permitted by a future compatibility profile.

New Loopable deployments SHOULD require TLS 1.3.

Application-level Loopable signatures remain mandatory even when TLS is used.

TLS authenticates the transport endpoint.

Loopable signatures authenticate protocol entities.

An implementation MUST NOT treat TLS certificate ownership as equivalent to Loopable instance identity.

---

# 28. Federation authentication

Federation requests MUST contain proof of the sender's instance identity.

The receiving instance MUST:

1. identify the claimed instance;
2. obtain or already possess its instance identity;
3. validate the operational key;
4. validate the operational key's authorization by the instance root;
5. validate the request signature;
6. validate freshness/replay protection;
7. process the request only if validation succeeds.

The exact HTTP authentication header and canonical request-signature serialization MUST be defined in the federation wire specification.

---

# 29. Federation model

Loopable federation is an authenticated event/object protocol.

It is not a command replication system.

It is not simply:

```text
POST /create-post
POST /delete-post
POST /follow
```

Instead, federation exchanges authenticated protocol objects and immutable events.

Events represent state transitions.

Objects contain encrypted application data.

Instances synchronize only data that is relevant to them.

---

# 30. Selective federation

Instances MUST NOT replicate the entire Loopable network.

An instance SHOULD exchange only:

* events relevant to its members
* objects required by those events
* objects explicitly requested
* federation metadata required for synchronization
* membership state relevant to federation policy

An instance MAY refuse federation with another instance according to its local federation policy.

---

# 31. Event IDs

Every event MUST have a cryptographically random event ID.

The event ID is 128 bits.

It MUST be generated independently from event contents.

It MUST NOT be derived from:

* plaintext
* ciphertext
* timestamp
* account ID
* event sequence
* object ID

The event ID is therefore not a content hash.

The probability of accidental collision MUST be negligible.

Implementations MUST reject an event whose event ID conflicts with a previously accepted event ID but whose canonical event bytes differ.

Such a conflict MUST be treated as a protocol integrity error.

---

# 32. Immutable events

Events are immutable.

Once an event has been accepted as valid, its contents MUST NOT be modified.

An edit MUST create a new event.

A deletion MUST create a new event.

A relationship change MUST create a new event.

A profile change MUST create a new event.

An event MUST NOT be silently rewritten.

---

# 33. Event DAG

Loopable events form a directed acyclic graph.

Each event MAY reference one or more predecessor events.

Example:

```text
        A
       / \
      B   C
       \ /
        D
```

The graph MUST be acyclic.

An implementation MUST reject an event whose dependency graph introduces a cycle.

The event's predecessor list MUST be canonicalized before signing.

The predecessor list MUST NOT contain duplicate IDs.

---

# 34. Event structure

Every event MUST contain conceptually:

```text
Event {
    protocol_version
    event_id
    event_type
    account_id
    device_id
    created_at
    predecessors[]
    object_references[]
    body
    signature
}
```

The exact serialization is defined by the canonical serialization specification.

---

# 35. Event timestamp

`created_at` is an informational event creation timestamp.

It MUST NOT be used as the sole mechanism for ordering events.

Clock skew MUST NOT invalidate an otherwise valid event solely because the local clocks differ.

The event DAG and cryptographic dependencies provide authoritative causal relationships.

---

# 36. Event ordering

Events do not have one universal global ordering.

Two independent events MAY be concurrent.

An implementation MUST NOT invent a global total ordering and treat it as protocol truth.

Where an application needs deterministic display ordering, the client MAY use a deterministic presentation ordering derived from:

1. causal dependencies;
2. event creation time;
3. event ID as a final deterministic tie-breaker.

That ordering is a presentation mechanism, not a replacement for the event DAG.

---

# 37. Missing events

If an instance receives an event whose predecessor is unavailable, it MUST NOT blindly apply the event.

It MUST:

1. record the missing dependency;
2. request the missing event;
3. retain the dependent event in a pending state;
4. validate the dependency when received;
5. apply the event only after all required dependencies are available.

A missing event request MUST identify the required event ID.

Instances MAY batch missing-event requests.

---

# 38. Synchronization

Federation synchronization MUST support:

* event discovery
* event retrieval
* object retrieval
* missing dependency recovery
* duplicate detection
* integrity verification
* replay protection
* resumption after disconnection

An implementation MUST be able to recover from a connection that terminates halfway through synchronization.

Synchronization MUST be idempotent.

Receiving the same valid event multiple times MUST NOT create multiple logical events.

---

# 39. Event replay

Events are immutable but federation messages carrying events are replayable at the transport level.

Receiving the same event again MUST NOT cause a second state transition.

The event ID MUST be used for deduplication.

Protocol operations that themselves require freshness MUST additionally use:

* request IDs
* timestamps
* nonces
* sequence numbers

as appropriate.

---

# 40. Objects

An object is encrypted application data.

Examples include:

* post
* reply
* profile
* image
* video
* file
* direct message
* relationship metadata
* membership metadata
* group metadata

Every object MUST have a unique object ID.

Object IDs MUST NOT expose plaintext content.

---

# 41. Object IDs

Object IDs SHOULD be 256-bit random identifiers.

Object IDs MUST be independent from plaintext.

They MUST NOT be generated as a hash of plaintext.

The object ID is an opaque protocol identifier.

---

# 42. Object envelope

The encrypted object envelope MUST contain conceptually:

```text
EncryptedObject {
    protocol_version
    object_id
    object_type
    encryption_suite
    key_id
    nonce
    ciphertext
    recipients
    metadata
}
```

The exact wire schema is normative.

---

# 43. Object content encryption

For ordinary Loopable objects:

```text
AES-256-GCM
```

MUST be used.

For each independently encrypted object:

1. generate a new random 256-bit content-encryption key;
2. generate a new random 96-bit AES-GCM nonce;
3. construct canonical associated data;
4. encrypt the plaintext;
5. authenticate the associated data.

The content-encryption key MUST NOT be derived directly from the user's password.

---

# 44. AES-GCM associated data

The AES-GCM associated data MUST authenticate all security-relevant unencrypted envelope fields.

At minimum:

```text
protocol_version
object_id
object_type
encryption_suite
key_id
```

MUST be included in the authenticated associated data.

The canonical encoding of these fields MUST be used.

This prevents an attacker from moving ciphertext between object types or changing object identifiers without authentication failure.

---

# 45. AES-GCM nonce

AES-GCM uses a 96-bit nonce.

The nonce MUST be unique for every encryption under a given AES-256-GCM key.

Because Loopable generates a fresh random object key for each object, implementations MUST still generate a fresh nonce for every encryption operation.

A nonce MUST NOT be reused with a different plaintext under the same object key.

---

# 46. Object key distribution

The object encryption key MUST NOT be stored in plaintext by an instance.

The content-encryption key MUST be encrypted or encapsulated for authorized recipients.

For individual recipients, Loopable MUST use HPKE.

For dynamic groups, Loopable MUST use MLS.

The instance may therefore store:

```text
ciphertext
+
encrypted key material
```

without being capable of decrypting the object.

---

# 47. HPKE object-key wrapping

For a recipient with an X25519 public key:

```text
CEK
  |
  v
HPKE
  |
  v
EncryptedRecipientKey
```

The sender MUST use the Loopable HPKE suite:

```text
DHKEM(X25519, HKDF-SHA256)
HKDF-SHA256
AES-256-GCM
```

The HPKE `info` parameter MUST contain the Loopable domain-separation context for object-key wrapping.

The exact `info` construction MUST include:

```text
"loopable hpke object-key v1"
```

and the relevant:

* object ID
* recipient key ID
* protocol version

in canonical encoding.

---

# 48. Recipient key records

An encrypted object MAY contain multiple recipient key records.

Each record identifies:

* recipient account
* recipient device or group
* encryption key ID
* HPKE encapsulated key
* encrypted content-encryption key

An unauthorized recipient MUST NOT receive usable key material.

---

# 49. Instance inability to decrypt

An instance MUST be able to:

* store encrypted objects
* forward encrypted objects
* verify event signatures
* verify envelope integrity
* synchronize objects
* enforce storage policy

without possessing plaintext decryption keys.

An instance MUST NOT be required to decrypt a normal social object to perform protocol operations.

The inability to decrypt is intentional.

---

# 50. Public content

A public post is still encrypted.

The authorization set for a public object may include every participant in a relevant context.

The encryption system therefore provides confidentiality against unauthorized infrastructure access while the social policy determines who may receive the key.

The instance database MUST NOT contain the plaintext simply because an object is public.

---

# 51. Profiles

Profiles are encrypted objects.

There is no plaintext public-profile category.

A profile MAY contain:

* username
* display name
* biography
* avatar reference
* profile media
* other profile information

All such information is encrypted.

---

# 52. Profile visibility

To view a user's profile, the viewer MUST belong to an instance context that permits access to that account.

A user outside that context MUST NOT automatically discover the account.

The client SHOULD behave as though the account does not exist.

This requirement prevents a global user directory from emerging accidentally through ordinary profile requests.

---

# 53. Instance membership

Instance membership is separate from:

* following
* friendship
* group membership
* profile visibility
* object audience

Joining an instance grants the member the ability to interact with the members and resources that the instance exposes according to protocol and local policy.

Membership does not automatically grant decryption access to every object associated with every member.

---

# 54. Account lookup

A member of an instance MAY perform a direct account lookup for an account hosted or present in that instance.

A lookup MAY return:

* canonical handle
* account ID
* account identity public key
* cryptographic identity metadata
* relevant membership state

It MUST NOT return:

* private keys
* device private keys
* complete device history
* unauthorized encrypted objects
* unauthorized social relationships

---

# 55. No automatic enumeration

Instance membership grants lookup capability.

It does not automatically require the instance to expose a complete member directory.

Implementations SHOULD prevent trivial bulk enumeration of every account.

Rate limiting MAY be used.

Local instance policy MAY impose additional restrictions.

---

# 56. Global account discovery

Loopable MUST NOT define a global public account directory.

A client MUST NOT be able to perform:

```text
search("every Loopable user")
```

through the base protocol.

Search is scoped to contexts and instances accessible to the user.

---

# 57. Following

Following is unilateral.

A user MAY follow another user without approval from the target user.

A follow is represented by an immutable signed event.

Removing a follow is represented by a separate immutable signed event.

Following MUST NOT itself grant cryptographic access to private content.

Following is a social relationship.

It is not an encryption primitive.

---

# 58. Follower/following privacy

The protocol defines the following rule:

A user may view another user's follower/following lists only if the other user follows the viewer.

Example:

```text
Alice follows Bob.
```

Bob may view Alice's follower/following lists.

But:

```text
Bob follows Alice.
Alice does not follow Bob.
```

Bob MUST NOT receive Alice's follower/following lists merely because Bob follows Alice.

Aggregate follower and following counts MAY be visible wherever the profile is visible.

The actual identities in the lists are separately protected.

---

# 59. Social graph encryption

Follower and following relationships MUST be represented as encrypted protocol objects/events.

Instances SHOULD NOT receive the complete plaintext social graph merely because they host the accounts involved.

The client is responsible for decrypting authorized social-graph information.

---

# 60. Contexts

Loopable contexts provide an authorization boundary for social interaction.

A context MAY represent:

* an instance-wide social space
* a private social space
* a group
* another protocol-defined audience

Context membership MUST NOT be conflated with instance membership.

An account may be a member of an instance without being a member of a particular private group.

---

# 61. Group encryption

Dynamic groups MUST use MLS.

Loopable MUST NOT define a proprietary group key-management protocol.

MLS provides:

* group encryption
* membership changes
* forward secrecy
* post-compromise security
* cryptographic group state

Loopable defines how MLS state is associated with Loopable accounts, devices, groups, and events.

The cryptographic internals remain governed by RFC 9420.

---

# 62. MLS identity binding

An MLS leaf MUST be cryptographically associated with the relevant Loopable device identity.

The MLS credential MUST contain sufficient information to bind the MLS participant to:

* account identity
* device identity
* device signing key

The binding MUST be independently verifiable.

An instance MUST NOT be able to substitute a different user's MLS identity.

---

# 63. Group membership

Group membership changes MUST be represented by authenticated protocol events.

The MLS group state is authoritative for cryptographic group membership.

The Loopable social layer determines whether a user is eligible to request membership.

The instance MAY enforce local membership policy.

The instance MUST NOT forge an MLS membership change.

---

# 64. Group deletion

Deleting or closing a group MUST produce a protocol event.

Clients MUST stop treating the group as active after the deletion state becomes authoritative.

Previously encrypted ciphertext may remain physically present on infrastructure.

Physical deletion and cryptographic inaccessibility are separate concerns.

---

# 65. Media

Images, videos, files, and other binary content are encrypted objects.

The plaintext media MUST be encrypted before being uploaded for persistent storage.

A media object MUST have:

* object ID
* media type
* byte length
* encrypted payload
* encryption metadata
* integrity information

Media metadata MUST be minimized.

Sensitive metadata SHOULD be removed from the plaintext media before encryption when practical.

---

# 66. Object storage

Any compatible instance MAY store encrypted objects.

Object storage location is independent of account identity location.

A storage instance does not become the object's cryptographic owner merely by storing it.

An object MAY be replicated to multiple instances.

Replication does not require plaintext access.

---

# 67. Object loss

Loopable does not provide a global persistence guarantee.

If an object exists only on one instance and that instance permanently disappears, the object may become unavailable.

Implementations MAY replicate objects for durability.

Replication SHOULD be performed using encrypted objects.

No instance is required to guarantee indefinite object retention.

---

# 68. Deletion

Deletion is represented by an immutable deletion event.

A deletion event MUST reference the object or object version being deleted.

Deletion MUST NOT mutate the original event.

The deletion event itself remains immutable.

Instances MUST apply deletion according to the object's authorization and retention rules.

---

# 69. Cryptographic deletion

Where practical, clients SHOULD delete locally stored decryption keys when content is deleted or access is revoked.

Cryptographic deletion can make ciphertext undecryptable even if physical ciphertext remains.

An implementation MUST NOT claim that physical deletion from every replica is guaranteed merely because a deletion event was created.

---

# 70. Edits

An edit creates a new object version and a new event.

Example:

```text
POST_CREATED
    |
    v
POST_EDITED
    |
    v
POST_EDITED
```

The original object MUST remain immutable.

The edit event MUST reference the previous object version.

Clients MAY display only the current version in normal UI while retaining the cryptographic history required by the protocol.

---

# 71. Object versioning

Every mutable logical object has an immutable version history.

A version record MUST identify:

* logical object ID
* version ID
* creating event
* predecessor version(s)
* encrypted object
* creator
* device
* creation timestamp

---

# 72. Conflict resolution

Because Loopable uses a DAG rather than a single global chain, concurrent edits are possible.

Two edits may legitimately reference the same predecessor.

Example:

```text
        A
       / \
      B   C
       \ /
        D
```

Implementations MUST NOT silently declare B or C invalid merely because they were concurrent.

The application-specific object type MUST define its conflict policy.

Where the object type does not define automatic conflict resolution, the client MUST present the conflict state or use a deterministic protocol-defined merge rule.

---

# 73. Canonical serialization

All signed protocol data MUST have one canonical binary representation.

The recommended canonical serialization format is deterministic CBOR according to the deterministic encoding requirements of RFC 8949.

The canonical representation MUST define:

* integer representation
* string encoding
* byte-string encoding
* map ordering
* array ordering
* null handling
* omission rules
* version fields

A signature MUST always be computed over the canonical byte representation.

JSON MUST NOT be used directly as the cryptographic signing representation.

Human-readable JSON MAY be provided as a debugging or API representation if it maps unambiguously to the canonical binary representation.

---

# 74. Map ordering

Protocol maps MUST be serialized deterministically.

Implementations MUST NOT rely on language-specific hash-map ordering.

Two implementations given identical logical protocol data MUST produce identical canonical bytes.

---

# 75. Signature input

A signed event MUST sign a domain-separated byte sequence.

Conceptually:

```text
signature_input =
    "loopable-event-v1\0" ||
    canonical_event_without_signature
```

The exact byte layout MUST be fixed by the canonical serialization schema.

The signature MUST be:

```text
Ed25519.Sign(
    device_private_signing_key,
    signature_input
)
```

---

# 76. Signature verification

A receiving implementation MUST:

1. decode the canonical structure;
2. validate field types;
3. validate field lengths;
4. validate protocol version;
5. validate account ID;
6. validate device ID;
7. resolve the device authorization;
8. validate the authorization chain;
9. reconstruct canonical signature input;
10. verify the Ed25519 signature;
11. validate event dependencies;
12. validate object references;
13. validate authorization policy.

Failure at any required step MUST cause rejection of the event.

---

# 77. Event authorization

An event is valid only if the signing device is authorized to perform the event type.

For example:

* ordinary post creation MAY be performed by an authorized device;
* device authorization MUST require trusted-device authority;
* device revocation MUST require trusted-device authority;
* account identity replacement MUST never be valid.

The event type defines its authorization requirements.

---

# 78. Event body encryption

Events and encrypted objects are distinct.

An event may contain encrypted object references and protocol metadata.

Sensitive application content SHOULD remain inside encrypted objects rather than being placed in plaintext event metadata.

An event MUST NOT contain plaintext social content unless the protocol explicitly defines that field as non-sensitive.

---

# 79. Metadata minimization

Loopable does not guarantee complete metadata privacy.

Instances may observe:

* network connections
* request timing
* object sizes
* storage operations
* federation relationships
* IP addresses at the transport layer
* protocol version
* account/instance routing metadata required for operation

Implementations SHOULD minimize retention.

Implementations MUST NOT expose metadata merely because it is convenient if the protocol does not require it.

---

# 80. Instance moderation

Instances control their own moderation.

An instance MAY:

* suspend local accounts
* reject federation
* reject object storage
* rate limit users
* block instances
* require approval for membership
* remove local access to content

These actions MUST NOT be represented as cryptographic deletion of another instance's global data unless the relevant authority actually controls that data.

---

# 81. Federation policy

Instances MAY define federation policies.

Policies MAY include:

* allowlist
* blocklist
* manual approval
* protocol-version restrictions
* resource limits
* object-size limits
* rate limits

An instance's local federation policy does not change the semantics of cryptographically valid events.

It only determines whether the instance chooses to accept or process them.

---

# 82. Private instances

A private instance may require:

* invitation
* administrator approval
* organizational membership
* another locally defined eligibility condition

The protocol MUST support the concept of membership restriction.

A private instance does not imply plaintext storage.

---

# 83. Public instances

"Public instance" means an instance that allows members of the general public to join according to its local policy.

It does NOT mean:

* plaintext database
* globally searchable users
* globally readable posts
* unrestricted federation
* unencrypted profiles

All normal Loopable encryption rules remain active.

---

# 84. Instance discovery

Instance discovery is explicitly **not part of the Loopable Protocol**.

It is an optional service.

The official Loopable client MAY use a centralized instance-discovery service.

That service MAY:

* list instances
* provide descriptions
* provide capacity information
* show operator policies
* show protocol versions
* provide abuse/security contacts

The disappearance of the discovery service MUST NOT prevent protocol interoperability.

---

# 85. Unlisted instances

Instances are unlisted by default.

Any compatible implementation MAY operate an unlisted instance.

Users MAY connect directly to an instance URL.

A discovery directory is therefore not a trust root.

---

# 86. Discovery directory trust

A discovery service MUST NOT be treated as the cryptographic authority for an instance.

The official client MUST independently verify the instance's cryptographic identity.

A discovery service MAY publish metadata describing an instance.

It MUST NOT be necessary for validating:

* account signatures
* device signatures
* instance signatures
* encrypted objects
* event authenticity

---

# 87. Instance discovery review

A Foundation-operated discovery directory MAY review applications using objective listing criteria.

The review MAY examine:

* instance domain
* operator contact
* intended community
* moderation policy
* privacy policy
* federation policy
* terms
* protocol version
* security contact
* capacity
* abuse contact
* instance cryptographic identity

The directory MUST NOT become a global protocol authority.

An unlisted instance remains a valid Loopable instance if it implements the protocol.

---

# 88. Search

Search is contextual.

A client MUST NOT perform unrestricted global account search.

Search MAY operate over:

* the user's current instance
* contexts the user belongs to
* locally available authorized content

Search indexes SHOULD be built from decrypted client-side data where privacy requirements make server-side indexing inappropriate.

Instances MAY provide encrypted-search mechanisms in future protocol versions, but such mechanisms are not assumed by version 0.1.

---

# 89. Notifications

Notifications are protocol objects/events.

Notification data SHOULD be encrypted.

A server SHOULD deliver notification envelopes without requiring plaintext access to their contents.

The client is responsible for decrypting notification information.

---

# 90. Direct messaging

Direct messages MUST use end-to-end encryption.

For one-to-one conversations, Loopable MAY use per-object encryption with HPKE.

For conversations with dynamic membership, Loopable MUST use MLS.

The instance MUST NOT require plaintext message access.

---

# 91. Social relationship events

Relationship state MUST be represented through immutable events.

Examples include:

```text
FOLLOW_CREATED
FOLLOW_REMOVED
BLOCK_CREATED
BLOCK_REMOVED
MUTE_CREATED
MUTE_REMOVED
```

The exact event registry is normative and versioned.

Relationship events MUST be signed by an authorized device.

---

# 92. Blocks

A block is a unilateral relationship.

A user MAY block another user without their approval.

A block MUST NOT require plaintext disclosure of unrelated social data.

An instance MAY additionally block traffic at the infrastructure layer.

Protocol-level blocking and instance-level federation blocking are distinct concepts.

---

# 93. Account deletion

Account deletion MUST be represented by an authenticated account-state event.

Account deletion does not retroactively invalidate historical cryptographic signatures.

Clients MUST treat the account as deleted after the deletion event becomes authoritative.

Instances SHOULD delete local encrypted objects according to retention policy.

Because replicas may exist, Loopable MUST NOT claim that an account deletion event physically erases every copy of every historical object.

---

# 94. Key destruction

Clients SHOULD destroy encryption keys that are no longer required.

Where an object is deleted and no legitimate authorized retention exists, the client SHOULD destroy the corresponding local decryption key.

Key destruction is especially important for:

* private messages
* deleted posts
* revoked group members
* deleted groups
* expired content

---

# 95. Forward secrecy

For MLS-protected groups, forward secrecy MUST be provided according to the guarantees of MLS.

For ordinary per-object encryption, Loopable does not claim forward secrecy merely because AES-GCM is used.

Where forward secrecy is required outside MLS, a future protocol component MUST explicitly define a ratcheting construction rather than inventing one.

---

# 96. Post-compromise security

MLS groups obtain post-compromise security according to RFC 9420.

Ordinary object encryption does not automatically provide post-compromise security.

Implementations MUST NOT advertise stronger guarantees than the cryptographic construction provides.

---

# 97. Server compromise

If an instance's database is compromised, an attacker SHOULD obtain at most:

* encrypted objects
* encrypted key envelopes
* signed events
* protocol metadata
* operational metadata retained by the instance

The attacker MUST NOT automatically obtain plaintext social content solely from compromising the instance database.

This property depends on clients correctly protecting private keys.

---

# 98. Client compromise

If a trusted device is compromised, the attacker may obtain plaintext and private cryptographic material available to that device.

The protocol cannot provide cryptographic confidentiality against a fully compromised endpoint that legitimately possesses decryption keys.

Device revocation exists to limit future authorization after compromise is detected.

---

# 99. Instance compromise

Compromise of an instance MUST NOT permit forging another instance's cryptographic identity unless the instance root key itself is compromised.

Operational federation-key compromise SHOULD be recoverable through root-key rotation and operational-key revocation.

---

# 100. Event authenticity

An event is authentic only if:

```text
valid account identity
+
valid device authorization
+
valid device signature
+
valid event structure
+
valid dependencies
```

are all satisfied.

Transport origin alone MUST NOT establish event authenticity.

---

# 101. Object authenticity

An encrypted object MUST contain enough authenticated metadata to prevent:

* object substitution
* ciphertext swapping
* object-type confusion
* recipient confusion
* object-ID substitution

The AES-GCM associated data provides authenticated binding between ciphertext and envelope metadata.

---

# 102. Replay protection

A repeated event ID MUST be treated as the same event.

A repeated federation request MUST NOT cause duplicate state transitions.

Requests requiring freshness MUST contain a protocol-defined request ID and freshness mechanism.

Instances MUST retain sufficient replay state for the protocol-defined validity window.

---

# 103. Request IDs

Federation requests SHOULD use 128-bit cryptographically random request IDs.

A request ID MUST NOT be reused by the same sender within the replay-protection window.

---

# 104. Rate limiting

Instances MAY rate limit:

* account lookup
* event submission
* federation
* object retrieval
* missing-event requests
* media upload
* membership requests

Rate limiting MUST NOT modify cryptographic semantics.

---

# 105. Error handling

Protocol errors MUST be machine-readable.

An error response SHOULD contain:

```text
error_code
message
request_id
retryable
```

Human-readable error text MUST NOT be treated as protocol semantics.

Clients MUST use error codes.

---

# 106. Protocol versions

Every protocol message MUST declare a protocol version or be associated with a protocol-versioned endpoint.

Version numbers use:

```text
MAJOR.MINOR
```

A major-version change MAY introduce incompatible wire behavior.

A minor-version change MUST preserve compatibility unless explicitly marked otherwise.

Implementations MUST reject unsupported major versions.

---

# 107. Capability negotiation

Instances SHOULD advertise supported protocol capabilities.

Capability negotiation MUST NOT silently change security semantics.

A capability MUST have:

* stable identifier
* version
* security implications
* compatibility behavior

Unknown optional capabilities MUST be safely ignored.

Unknown mandatory capabilities MUST cause an explicit incompatibility response.

---

# 108. Algorithm agility

Protocol cryptographic algorithms are versioned.

An implementation MUST NOT silently substitute another algorithm.

Future cryptographic suites MUST receive explicit protocol identifiers.

The meaning of an existing encryption-suite identifier MUST never change.

---

# 109. Downgrade protection

An attacker MUST NOT be able to force two implementations to use a weaker algorithm merely by removing capability advertisements.

Security-critical algorithms MUST have minimum requirements.

For example, an implementation supporting Loopable 0.1 MUST support:

```text
Ed25519
X25519
SHA-256
HKDF-SHA-256
AES-256-GCM
HPKE X25519/HKDF-SHA256/AES-256-GCM
MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519
```

---

# 110. Canonical account identifier

Account IDs are derived from identity public keys.

The derivation is:

```text
SHA-256(
    ASCII("loopable-account-id\0") ||
    Ed25519PublicKey
)
```

The resulting 32 bytes are encoded using lowercase Base32 without padding.

---

# 111. Canonical instance identifier

Instance IDs use:

```text
SHA-256(
    ASCII("loopable-instance-id\0") ||
    InstanceRootEd25519PublicKey
)
```

The result is encoded as lowercase Base32 without padding.

---

# 112. Canonical event signing domain

Event signatures use:

```text
ASCII("loopable-event-v1\0")
||
CanonicalEventWithoutSignature
```

No other application may reuse the Loopable event signature domain.

---

# 113. Canonical object encryption domain

Object encryption associated data MUST use a separate domain from event signatures.

Conceptually:

```text
ASCII("loopable-object-v1\0")
||
CanonicalObjectSecurityMetadata
```

This prevents cryptographic cross-protocol confusion.

---

# 114. Canonical HPKE domain

Loopable object-key HPKE uses:

```text
ASCII("loopable-hpke-object-key-v1\0")
||
object_id
||
recipient_key_id
||
protocol_version
```

encoded canonically.

---

# 115. Object key lifecycle

For an ordinary encrypted object:

1. Client generates a random 256-bit CEK.
2. Client generates a random 96-bit nonce.
3. Client canonicalizes authenticated metadata.
4. Client encrypts plaintext using AES-256-GCM.
5. Client encrypts the CEK separately for each authorized recipient using HPKE.
6. Client constructs the encrypted object envelope.
7. Client creates the corresponding event.
8. Client signs the event using the device Ed25519 key.
9. Client submits the event and object to the relevant instance.

The instance never needs the plaintext CEK.

---

# 116. Multiple recipients

Each recipient MUST receive independently protected key material.

The same CEK MAY be wrapped for multiple recipients.

The plaintext CEK MUST NOT be sent directly to recipients over federation.

Recipient-specific HPKE ciphertexts MUST be independently authenticated.

---

# 117. Revocation of an individual recipient

Removing a recipient from future access does not retroactively make previously obtained plaintext disappear.

For future objects, the client MUST exclude the revoked recipient from new key envelopes.

For groups, MLS membership changes MUST be used where applicable.

If stronger cryptographic revocation is required for existing ciphertext, the protocol MUST rotate the relevant encryption key and create a new encrypted version.

---

# 118. Instance object relay

An instance MAY relay ciphertext without decrypting it.

A relay MUST preserve:

* object ID
* ciphertext
* encryption metadata
* recipient envelopes
* integrity metadata

A relay MUST NOT modify authenticated ciphertext.

---

# 119. Object deduplication

Instances MAY deduplicate objects by object ID.

They MUST NOT assume that equal plaintext necessarily has equal object IDs.

Object IDs are random and therefore intentionally do not provide plaintext-based deduplication.

---

# 120. Storage privacy

Instances SHOULD encrypt their own databases and storage volumes.

This is separate from Loopable's end-to-end encryption.

Disk encryption protects against physical storage theft.

Loopable E2EE protects against unauthorized logical access to plaintext.

Both are useful.

---

# 121. Federation synchronization state

Each federation relationship SHOULD maintain synchronization state including:

```text
peer_instance_id
last_successful_sync
known_event_ids
known_object_ids
pending_dependencies
protocol_version
capabilities
```

The exact persistent representation is implementation-defined.

---

# 122. Synchronization correctness

Synchronization MUST be idempotent.

If synchronization stops after event 100 of 200, the next synchronization MUST resume without corrupting or duplicating the first 100 events.

Instances SHOULD support incremental synchronization.

---

# 123. Event dependency requests

A missing dependency request MUST identify the requested event ID.

A response MAY contain:

* requested event
* additional dependency events
* authorization metadata
* error indicating the event is unavailable

An instance MUST NOT fabricate an event to satisfy a dependency.

---

# 124. Unavailable dependencies

If a dependency cannot be retrieved, the dependent event MUST remain unresolved.

The implementation MUST NOT treat the dependent event as authoritative state until required validation can be completed.

The implementation MAY expose the unresolved event to diagnostic tooling.

---

# 125. Malformed events

Malformed events MUST be rejected.

Examples include:

* invalid signature
* invalid account ID
* invalid device authorization
* malformed canonical encoding
* duplicate predecessor
* cyclic dependency
* invalid timestamp representation
* unknown mandatory field
* invalid object reference
* invalid cryptographic parameters

---

# 126. Unknown event types

Unknown optional event types MAY be retained as opaque events.

Unknown mandatory event types MUST NOT be applied.

The implementation MUST preserve enough information to avoid corrupting the event DAG.

---

# 127. Event persistence

Once an instance accepts a valid event, it SHOULD persist the immutable event.

Instances MAY apply local retention policies where protocol semantics permit.

Retention MUST NOT modify event contents.

---

# 128. Event history versus application state

The event history is authoritative protocol evidence.

Application state is derived from valid events and encrypted objects.

Implementations MAY maintain materialized state for performance.

Materialized state MUST be reconstructible from protocol data.

A database cache MUST NOT become the sole source of truth.

---

# 129. Client local state

A compliant client SHOULD maintain local state including:

* account identity
* trusted device keys
* device authorization state
* known instances
* encrypted object cache
* decrypted object cache
* event DAG
* synchronization state
* MLS state
* social graph state
* notification state

Sensitive local state MUST be protected by the platform's secure storage mechanisms where available.

---

# 130. Private-key storage

Private keys MUST NOT be written to ordinary plaintext application logs.

Private keys MUST NOT appear in:

* analytics
* crash reports
* federation requests
* debug output
* test fixtures
* Git repositories

Private keys SHOULD be stored using OS-backed secure storage.

---

# 131. Logging

Instances MUST NOT log plaintext encrypted-object contents.

Instances SHOULD avoid logging:

* decrypted data
* private key material
* complete social graphs
* unnecessary account metadata

Security-sensitive identifiers SHOULD be redacted where practical.

---

# 132. Test vectors

The protocol repository MUST contain test vectors for deterministic cryptographic operations.

At minimum, test vectors MUST eventually cover:

* Ed25519 account signatures
* device authorization
* event signing
* canonical serialization
* account ID derivation
* instance ID derivation
* AES-256-GCM object encryption
* object associated data
* HPKE object-key wrapping
* event DAG validation
* missing dependency behavior
* deletion events
* username changes
* MLS integration

Cryptographic test vectors MUST use non-secret synthetic keys and data.

---

# 133. Interoperability

Two independent implementations are interoperable when they can:

1. exchange instance identities;
2. authenticate federation;
3. exchange events;
4. validate event signatures;
5. resolve device authorization;
6. reconstruct event dependencies;
7. exchange encrypted objects;
8. decrypt authorized objects;
9. apply social relationship events;
10. synchronize after missing events.

The protocol specification MUST contain enough information for this behavior without relying on implementation-specific knowledge.

---

# 134. Security boundaries

The following trust hierarchy is normative:

```text
Account Identity
        |
        v
Authorized Device
        |
        v
Signed Event
        |
        v
Encrypted Object
```

Instances sit beside this hierarchy rather than above it:

```text
                 Account Identity
                        |
                        v
                 Authorized Device
                        |
                        v
                    Event
                        |
                        v
                Encrypted Object

Instance --------------------------+
    |                              |
    +-- stores ciphertext          |
    +-- transports events          |
    +-- verifies signatures        |
    +-- synchronizes data          |
    +-- applies local policy       |
                                   |
                                   v
                         MUST NOT control
                         account identity
```

---

# 135. What an instance can know

The protocol does not claim that instances know nothing.

Depending on deployment, an instance may know:

* that an account exists locally
* account routing information
* membership state required for operation
* network addresses
* federation peers
* request timing
* object sizes
* object IDs
* event IDs
* event signatures
* encrypted metadata
* storage usage

The protocol's goal is to prevent this operational visibility from becoming automatic plaintext access.

---

# 136. What an instance must not be able to do

Without compromising authorized user devices, an instance MUST NOT be able to:

* derive an account's identity private key
* derive a device private key
* decrypt arbitrary private posts
* decrypt private messages
* decrypt private profile data
* forge an account event
* authorize a new account device
* silently replace an account identity
* manufacture a valid user signature

---

# 137. Cryptographic failure behavior

If decryption fails because authentication fails, the implementation MUST treat the ciphertext as invalid.

It MUST NOT attempt alternative keys indefinitely.

It MUST NOT silently ignore authentication failures.

AES-GCM authentication failure MUST NOT return partially decrypted plaintext.

HPKE authentication failure MUST be treated as a failed decryption.

MLS validation failures MUST follow RFC 9420.

---

# 138. Side-channel considerations

Cryptographic implementations SHOULD use constant-time primitives provided by mature cryptographic libraries.

Implementations SHOULD avoid:

* custom AES implementations
* custom Ed25519 implementations
* custom X25519 implementations
* custom GCM implementations

unless there is a compelling expert-reviewed reason.

The preferred implementation strategy is to use audited cryptographic libraries.

---

# 139. Cryptographic library requirements

A Loopable implementation SHOULD use a maintained, security-reviewed cryptographic library supporting:

* Ed25519
* X25519
* AES-GCM
* HKDF
* HPKE
* MLS

Implementations MUST NOT implement these primitives from their mathematical definitions inside application code unless required by a specialized cryptographic library implementation.

---

# 140. Domain separation

Every Loopable cryptographic construction MUST have an explicit purpose.

The same key material MUST NOT be used interchangeably between:

* account signing
* device signing
* object encryption
* HPKE
* MLS
* instance signing

Different purposes MUST use different key types or cryptographically separated contexts.

---

# 141. Account identity versus encryption identity

The Ed25519 account identity key is a signing identity.

It MUST NOT be directly used as an X25519 encryption key.

The account has separate cryptographic roles.

This separation prevents accidental use of signing material as encryption material.

---

# 142. Device signing versus device encryption

Each device MUST maintain separate:

```text
Ed25519 signing key
X25519 encryption/key-agreement key
```

The signing key authenticates device actions.

The X25519 key participates in encryption mechanisms.

---

# 143. Instance signing versus TLS

Instance Ed25519 identity keys authenticate Loopable protocol identity.

TLS keys authenticate TLS sessions.

They are separate.

An instance MUST NOT derive its Loopable identity from its TLS certificate.

Changing a TLS certificate MUST NOT change the Loopable instance identity.

---

# 144. Canonical text encoding

All protocol strings MUST use UTF-8.

Normalization requirements MUST be specified for user-visible identifiers.

Usernames SHOULD use a restricted canonical character set to avoid Unicode confusables.

A future username specification MUST define:

* allowed Unicode ranges
* case folding
* normalization
* prohibited characters
* confusable handling
* maximum length

Implementations MUST NOT invent different username normalization rules.

---

# 145. Hostnames

Instance hostnames MUST follow DNS hostname rules.

Protocol canonicalization MUST define:

* lowercase conversion
* trailing-dot handling
* IDNA handling
* port handling
* URL normalization

A future hostname canonicalization section MUST be normative before version 1.0.

---

# 146. Account relocation

Account identity and account hosting are separate concepts.

A future protocol version MAY support moving an account from one instance to another.

Such migration MUST preserve the account identity key.

An instance MUST NOT create a new identity merely because the hosting instance changes.

Migration MUST be represented by authenticated state transitions.

---

# 147. Object relocation

Objects MAY move between storage instances.

The object ID remains unchanged.

The encrypted object remains cryptographically bound to its object metadata.

Changing the storage location MUST NOT require changing the object's identity.

---

# 148. Storage authorization

An instance may store an object if:

* the object was submitted by an authorized participant;
* the instance accepted storage according to local policy;
* federation rules permit the transfer.

Storage authorization is not equivalent to plaintext decryption authorization.

---

# 149. Federation authorization

An instance MUST distinguish:

1. "This peer is cryptographically authentic."
2. "This peer is permitted to federate with me."
3. "This peer is authorized to send this object."
4. "This object is authorized for a particular user."
5. "I possess the key to decrypt this object."

These are separate checks.

Passing one does not imply passing the others.

---

# 150. Privacy boundary

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

Plaintext MUST remain at the client unless a future protocol explicitly defines an exception.

---

# 151. No server-side plaintext requirement

The official Loopable implementation MUST NOT require server-side plaintext decryption merely because it is easier to implement a feature.

If a feature cannot be implemented without server-side plaintext access, the feature MUST be redesigned or explicitly specified as a different security class.

---

# 152. Security classifications

Future protocol extensions SHOULD classify operations as:

```text
CLIENT_ONLY
INSTANCE_VERIFIABLE
FEDERATION_VERIFIABLE
INSTANCE_PLAINTEXT_REQUIRED
```

`INSTANCE_PLAINTEXT_REQUIRED` should be avoided for normal social data.

---

# 153. Object authorization

Every encrypted object MUST have a defined authorization model.

The authorization model determines who receives decryption material.

Possible models include:

* single recipient
* explicit recipient set
* context membership
* MLS group
* public context
* private context

Following is not an authorization model.

---

# 154. Audience changes

Changing an object's audience MUST create a new event.

The original encrypted object MUST remain immutable.

If the new audience requires different cryptographic recipients, a new encryption envelope SHOULD be generated.

For highly sensitive audience changes, clients SHOULD re-encrypt the content under a new content-encryption key.

---

# 155. Public-to-private transitions

Changing an object from public authorization to restricted authorization MUST NOT merely modify metadata.

The object SHOULD be re-encrypted with a new content-encryption key.

The new key MUST be distributed only to the authorized recipients.

---

# 156. Private-to-public transitions

Changing an object from private to public SHOULD generate a new encryption envelope and, where required, a new object version.

Existing private keys MUST NOT be reused as the public distribution mechanism if that would preserve unauthorized access.

---

# 157. Forwarding

When a user forwards an object, the forwarded object SHOULD normally be treated as a new logical object.

The new object MUST have:

* a new object ID
* a new encryption key
* a new event

The original object authorization MUST NOT automatically transfer to the forwarded object.

---

# 158. Quotes and replies

A reply MAY reference an earlier object.

The reference MUST NOT automatically grant the recipient access to the referenced object.

If a client is not authorized to decrypt the referenced object, it MUST treat the reference as unavailable.

A reply MUST NOT leak plaintext from an inaccessible parent.

---

# 159. Notification privacy

A notification MUST NOT expose plaintext content that the recipient is not authorized to decrypt.

For example, an instance MUST NOT need to know:

```text
"Alice mentioned Bob in this post."
```

in plaintext simply to route a notification.

The protocol SHOULD use encrypted notification payloads or equivalent client-decryptable metadata.

---

# 160. Protocol state

Implementations SHOULD distinguish:

```text
KNOWN
VALIDATED
AUTHORIZED
DECRYPTABLE
APPLIED
REVOKED
DELETED
UNAVAILABLE
```

These states MUST NOT be conflated.

An event may be:

```text
VALIDATED = true
DECRYPTABLE = false
```

and remain completely valid.

---

# 161. Unreadable ciphertext

An instance receiving ciphertext that it cannot decrypt MUST NOT treat that as a protocol error.

This is normal Loopable behavior.

The instance only needs to verify the cryptographic envelope and event authorization necessary for its role.

---

# 162. Client decryption

A client SHOULD decrypt objects only after:

1. validating object envelope;
2. validating event authenticity;
3. validating audience authorization;
4. locating the appropriate key;
5. authenticating ciphertext.

Plaintext MUST NOT be presented before successful authentication.

---

# 163. Secure deletion on clients

Clients SHOULD securely remove:

* deleted plaintext caches
* revoked group keys
* obsolete object keys
* expired temporary plaintext

The protocol cannot guarantee physical storage erasure on every operating system.

---

# 164. Backups

Backups are implementation-defined.

A client MAY back up encrypted account/device material.

A backup system MUST NOT silently become a second trusted device.

If a backup contains sufficient private key material to recover an account, that recovery mechanism MUST be explicitly defined and user-controlled.

The base protocol does not define such a mechanism.

---

# 165. Security model summary

The intended security properties are:

### Account authenticity

Only an authorized device can produce valid account events.

### Device authenticity

Devices are cryptographically authorized by the account's trust chain.

### Content confidentiality

Instances store ciphertext rather than required plaintext.

### Object integrity

Authenticated encryption prevents undetected ciphertext modification.

### Event integrity

Immutable signed events prevent silent historical modification.

### Federation authenticity

Instances authenticate one another independently of TLS alone.

### Group security

MLS provides standardized dynamic group encryption.

### Failure containment

Compromising an instance should not automatically compromise account private keys.

---

# 166. Protocol invariants

Every compliant implementation MUST preserve these invariants.

## Invariant 1

An account identity key never changes.

## Invariant 2

An account has exactly one trusted device.

## Invariant 3

A device cannot become trusted without cryptographic authorization.

## Invariant 4

Instances cannot authorize devices.

## Invariant 5

Events are immutable.

## Invariant 6

Events form an acyclic dependency graph.

## Invariant 7

Event IDs are random and independent from event contents.

## Invariant 8

Objects are encrypted.

## Invariant 9

Ordinary object encryption uses AES-256-GCM.

## Invariant 10

MLS groups use the mandatory MLS 1.0 cipher suite.

## Invariant 11

Account signatures use Ed25519.

## Invariant 12

Device encryption keys use X25519.

## Invariant 13

General HPKE uses X25519/HKDF-SHA256/AES-256-GCM.

## Invariant 14

An instance does not need plaintext decryption keys to operate.

## Invariant 15

There is no protocol-level global public user directory.

## Invariant 16

Following does not itself grant decryption access.

## Invariant 17

Identity location and object storage location are independent.

## Invariant 18

Discovery services are not protocol trust roots.

## Invariant 19

Deleting or editing an object creates a new event.

## Invariant 20

Missing dependencies are explicitly synchronized.

---

# 167. Required implementation layers

An implementation SHOULD be separated into:

```text
Protocol Core
    |
    +-- Serialization
    +-- Cryptography
    +-- Identity
    +-- Device Authorization
    +-- Event DAG
    +-- Object Encryption
    +-- MLS
    +-- Federation
    +-- Storage
    +-- Application Model
    +-- Client UI
```

The protocol core MUST NOT depend on a specific UI.

---

# 168. Protocol core requirements

The protocol core MUST be able to:

* parse protocol objects
* produce canonical serialization
* verify signatures
* validate identity chains
* validate event DAGs
* encrypt objects
* decrypt authorized objects
* process key envelopes
* process device authorization
* process revocation
* validate federation messages

---

# 169. Implementation independence

The official implementation MUST NOT be treated as a specification oracle.

If an implementation contains behavior not described by this specification, that behavior is not automatically part of Loopable.

If interoperability depends on an implementation-specific behavior, the behavior MUST be added to the protocol specification before it becomes normative.

---

# 170. Test requirements

Before a Loopable implementation is considered protocol-compatible, it SHOULD pass:

* serialization tests
* cryptographic tests
* identity tests
* device tests
* event tests
* DAG tests
* federation tests
* encryption tests
* MLS tests
* deletion tests
* username tests
* synchronization tests
* negative/security tests

Negative tests are especially important.

---

# 171. Required negative tests

Implementations MUST reject:

* invalid Ed25519 signatures
* unauthorized devices
* revoked devices producing new events
* malformed event IDs
* duplicate event IDs with different contents
* invalid DAG cycles
* missing dependencies treated as valid
* invalid AES-GCM authentication
* invalid HPKE ciphertext
* unauthorized recipient key use
* malformed canonical encodings
* unsupported mandatory versions
* forged instance signatures
* forged account signatures
* invalid username ownership transitions

---

# 172. Future extension process

A protocol extension MUST specify:

1. problem being solved
2. security impact
3. privacy impact
4. wire representation
5. authorization model
6. cryptographic requirements
7. compatibility behavior
8. failure behavior
9. synchronization behavior
10. test vectors

No extension should be merged merely because an implementation already exists.

---

# 173. Version 0.1 mandatory algorithm table

| Purpose                       | Algorithm                                    |
| ----------------------------- | -------------------------------------------- |
| Account signatures            | Ed25519                                      |
| Device signatures             | Ed25519                                      |
| Instance signatures           | Ed25519                                      |
| Account/device key agreement  | X25519                                       |
| General object encryption     | AES-256-GCM                                  |
| General KDF                   | HKDF-SHA-256                                 |
| General protocol hashing      | SHA-256                                      |
| General public-key encryption | HPKE                                         |
| HPKE KEM                      | DHKEM(X25519, HKDF-SHA256)                   |
| HPKE KDF                      | HKDF-SHA256                                  |
| HPKE AEAD                     | AES-256-GCM                                  |
| Group encryption              | MLS                                          |
| Mandatory MLS suite           | MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519 |
| Transport                     | HTTPS                                        |
| Minimum modern TLS            | TLS 1.3                                      |
| Canonical serialization       | Deterministic CBOR                           |

---

# 174. Important cryptographic distinction

The following algorithms MUST NOT be conflated:

```text
Ed25519
    = signatures

X25519
    = key agreement / KEM

AES-256-GCM
    = general Loopable object encryption

HPKE
    = standardized public-key encryption construction

MLS
    = standardized dynamic group encryption

AES-128-GCM
    = the AEAD used by the mandatory MLS 1.0 suite
```

The fact that MLS uses AES-128-GCM does not mean ordinary Loopable objects use AES-128-GCM.

Ordinary Loopable objects use AES-256-GCM.

---

# 175. Security rationale

Loopable deliberately uses separate cryptographic layers.

The account identity answers:

> "Which account is this?"

The device identity answers:

> "Which authorized device produced this?"

The event signature answers:

> "Did this authorized device create this exact event?"

The object encryption answers:

> "Who can decrypt this data?"

HPKE answers:

> "How can the object key be securely delivered to one recipient?"

MLS answers:

> "How can a changing group securely share encrypted state?"

TLS answers:

> "Is this network connection protected?"

Instance identity answers:

> "Which Loopable instance is communicating with me?"

These are different security questions and MUST remain different protocol concepts.

---

# 176. Final protocol model

A normal Loopable post creation therefore conceptually looks like this:

```text
User
 |
 | writes post
 v
Client
 |
 | generates plaintext object
 |
 | generates random 256-bit CEK
 |
 | generates random 96-bit AES-GCM nonce
 |
 | AES-256-GCM encrypts object
 |
 | HPKE-wraps CEK for authorized recipients
 |
 | creates immutable POST_CREATED event
 |
 | signs event with device Ed25519 key
 |
 v
Instance
 |
 | validates device authorization
 | validates event signature
 | validates DAG dependencies
 | stores ciphertext
 |
 v
Federation
 |
 | sends authenticated event/object
 |
 v
Other Instance
 |
 | validates instance authentication
 | validates event
 | stores ciphertext
 |
 v
Authorized Client
 |
 | obtains ciphertext
 | obtains encrypted CEK
 | recovers CEK using X25519 private key
 | AES-256-GCM authenticates/decrypts
 |
 v
Plaintext
```

At no point does the protocol require the hosting instance to possess the plaintext.

---

# 177. Final architecture

The complete Loopable trust model is:

```text
                         LOOPABLE NETWORK
                               |
              +----------------+----------------+
              |                                 |
          INSTANCE A                        INSTANCE B
              |                                 |
        Instance Identity                 Instance Identity
              |                                 |
        Federation Keys                  Federation Keys
              |                                 |
              +---------- authenticated --------+
                         federation
                              |
                       encrypted objects
                              |
                    immutable event DAG
                              |
                +-------------+-------------+
                |                           |
          Account Alice                Account Bob
                |                           |
         Account Identity              Account Identity
           Ed25519 root                  Ed25519 root
                |                           |
          Trusted Device                Trusted Device
                |                           |
          Device Ed25519                Device Ed25519
          Device X25519                 Device X25519
                |                           |
              Events                      Events
                |                           |
          AES-256-GCM                   AES-256-GCM
                |                           |
          HPKE / MLS                    HPKE / MLS
                |                           |
             plaintext                  plaintext
```

This is the fundamental architecture of Loopable.

The protocol's security does not depend on every instance being honest.

It depends on cryptographic identity, authenticated events, end-to-end encryption, independently verifiable device authorization, and standardized cryptographic constructions.

---

# 178. Implementation requirement before version 1.0

This document establishes the foundational protocol architecture.

Before Loopable Protocol 1.0 is declared stable, the following MUST be fully specified rather than left implementation-defined:

1. complete canonical CBOR schemas
2. every event type
3. every event field
4. every object type
5. every object field
6. exact account-ID encoding
7. exact instance-ID encoding
8. exact username grammar
9. exact hostname canonicalization
10. exact federation HTTP endpoints
11. exact HTTP authentication format
12. exact federation request signature construction
13. exact request replay window
14. exact event serialization
15. exact event signature input
16. exact object envelope schema
17. exact AES-GCM associated-data encoding
18. exact HPKE envelope encoding
19. exact recipient-key representation
20. exact device authorization schema
21. exact device revocation schema
22. exact trusted-device transfer schema
23. exact account deletion semantics
24. exact object deletion semantics
25. exact object versioning semantics
26. exact concurrent-edit semantics
27. exact synchronization protocol
28. exact missing-event protocol
29. exact error registry
30. exact capability registry
31. exact protocol-version negotiation
32. exact MLS-to-Loopable identity binding
33. exact MLS event representation
34. exact group lifecycle
35. exact membership lifecycle
36. exact profile authorization
37. exact follower/following authorization
38. exact search semantics
39. exact notification model
40. exact media protocol
41. exact object-storage API
42. exact retention semantics
43. exact replication semantics
44. complete cryptographic test vectors
45. complete serialization test vectors
46. interoperability test suite
47. security audit of the cryptographic composition
48. security review of federation authentication
49. metadata/privacy analysis
50. downgrade and compatibility analysis

Until these are specified, this document MUST be considered a foundational draft rather than a final wire-level standard.

---

# 179. Source-of-truth rule

The `spec/` directory is the authoritative definition of Loopable protocol behavior.

Machine-readable schemas MUST agree with the specification.

Examples MUST agree with the specification.

Test vectors MUST agree with the specification.

The official implementation MUST agree with the specification.

If an implementation, example, schema, or test vector contradicts the specification, the specification takes precedence until the discrepancy is resolved through a protocol change.

---

# 180. Core principle

The Loopable Protocol can be summarized as:

> **Cryptographically stable identities, independently authorized devices, immutable authenticated events, encrypted objects, selective federation, and no requirement for infrastructure to possess plaintext.**

Everything else in the protocol exists to make those properties interoperable, usable, and enforceable.
