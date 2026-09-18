# 20. Cryptographic primitives

This module is the authoritative registry of mandatory cryptographic algorithms, parameters, and domain-separation labels for Loopable 0.1.

## 20.1 General requirements

Loopable MUST use established cryptographic primitives. An implementation MUST NOT invent a new cryptographic primitive or replace a protocol-defined primitive with a proprietary equivalent.

An implementation SHOULD use a maintained, security-reviewed cryptographic library supporting the algorithms in this module. Implementations MUST NOT implement these primitives from their mathematical definitions inside application code, unless they are themselves the specialized cryptographic library, per `90-security.md`.

## 20.2 Mandatory algorithm table

| Purpose | Algorithm |
| ------- | --------- |
| Account signatures | Ed25519 (RFC 8032) |
| Device signatures | Ed25519 (RFC 8032) |
| Instance signatures | Ed25519 (RFC 8032) |
| Account/device key agreement | X25519 (RFC 7748) |
| General object encryption | AES-256-GCM (RFC 5116, NIST SP 800-38D) |
| Streaming media encryption | AES-256-GCM-HKDF Streaming AEAD (`35-media-encryption.md`) |
| General KDF | HKDF-SHA-256 (RFC 5869) |
| General protocol hashing | SHA-256 (FIPS 180-4) |
| General public-key encryption | HPKE (RFC 9180) |
| HPKE KEM | DHKEM(X25519, HKDF-SHA256) |
| HPKE KDF | HKDF-SHA256 |
| HPKE AEAD | AES-256-GCM |
| Group encryption | MLS (RFC 9420) |
| Mandatory MLS suite | `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` |
| Transport | HTTPS (RFC 8446) |
| Minimum modern TLS | TLS 1.3 |
| Canonical serialization | Deterministic CBOR (RFC 8949) |

Supporting these algorithms is a minimum requirement. An implementation supporting Loopable 0.1 MUST support each of them. An attacker MUST NOT be able to force a weaker configuration by removing capability advertisements; downgrade protection is defined in `81-versioning-and-capabilities.md`.

## 20.3 Ed25519 signatures

Ed25519 is defined by RFC 8032 and is used for:

* account identity signatures;
* device signatures;
* instance identity signatures;
* instance operational-key signatures;
* federation request signatures.

Parameters and rules:

1. Ed25519 public keys are exactly 32 bytes.
2. Ed25519 signatures are exactly 64 bytes.
3. Ed25519 private keys MUST be generated using a cryptographically secure random source.
4. Private keys MUST never be transmitted unencrypted over the network.
5. Ed25519 is a signing algorithm only. An Ed25519 key MUST NOT be used as an encryption or key-agreement key.

## 20.4 X25519 key agreement

X25519 is defined by RFC 7748 and is used for:

* HPKE KEM operations;
* key agreement where explicitly specified;
* device-to-device cryptographic operations where the relevant protocol section specifies X25519.

Rules:

1. X25519 public keys are exactly 32 bytes.
2. X25519 private keys are exactly 32 bytes.
3. X25519 MUST NOT be used as a signature algorithm.
4. Ed25519 and X25519 key pairs MUST be treated as separate key types. An implementation MUST NOT assume an Ed25519 private key can be reused as an X25519 private key.

## 20.5 SHA-256 hashing

The protocol uses SHA-256 for:

* protocol fingerprints;
* cryptographic references where specified;
* object integrity hashes where specified;
* canonicalized protocol metadata hashes;
* identifier derivations (`10-identifiers.md`);
* inner constructions of HKDF, HPKE, and MLS where those standards call for SHA-256.

SHA-256 outputs exactly 32 bytes. A hash MUST NOT be treated as a secret.

## 20.6 HKDF-SHA-256

Where the protocol requires a general-purpose key derivation function, it MUST use HKDF-SHA-256 instantiated per RFC 5869.

Every Loopable-defined HKDF construction MUST define its input keying material, salt, info string, output length, and domain-separation label in the module that uses it, and MUST use a unique domain-separation label. Implementations MUST NOT use a single undifferentiated HKDF namespace for unrelated purposes.

## 20.7 AES-256-GCM

General Loopable encrypted objects MUST use AES-256-GCM.

| Parameter | Value |
| --------- | ----- |
| Key size | 256 bits (32 bytes) |
| Nonce size | 96 bits (12 bytes) |
| Authentication tag | 128 bits (16 bytes) |

Rules:

1. Every encryption operation MUST use a nonce never reused with the same AES-GCM key.
2. A content-encryption key MUST NOT be reused between independently encrypted objects unless a specific protocol mechanism explicitly defines key reuse.
3. A fresh random CEK and fresh random nonce MUST be generated for each independently encrypted object, per `23-encryption.md`.
4. The content-encryption key MUST NOT be derived directly from a user password.
5. The protocol authenticates the associated data defined in `23-encryption.md`.

The AES-GCM encryption and decryption constructions used by the protocol are defined in `23-encryption.md`.

Media objects use a segmented streaming construction built from AES-256-GCM and HKDF-SHA-256, defined in `35-media-encryption.md`. It is `encryption_suite` `1`; it does not replace AES-256-GCM for ordinary objects (`20.10`).

## 20.8 HPKE

HPKE (RFC 9180) is the standard public-key encryption construction for encrypting a secret to one recipient.

The mandatory Loopable HPKE suite is:

```text
KEM:  DHKEM(X25519, HKDF-SHA256)    KEM ID 0x0020
KDF:  HKDF-SHA256                   KDF ID 0x0001
AEAD: AES-256-GCM                   AEAD ID 0x0002
```

The HPKE Base mode MUST be used unless a specific protocol operation explicitly requires another mode. Loopable MUST NOT invent a replacement for HPKE. HPKE usage is defined in `24-hpke.md`.

## 20.9 MLS

Dynamic multi-party encrypted groups MUST use Messaging Layer Security, RFC 9420.

The mandatory MLS 1.0 cipher suite is:

```text
MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519
```

This cipher suite means: DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-128-GCM, SHA-256, Ed25519. MLS implementations MUST implement this suite.

Loopable MUST NOT replace MLS's AES-128-GCM with AES-256-GCM inside the MLS cipher suite. AES-256-GCM applies to Loopable's general object encryption layer; MLS cryptography remains governed by RFC 9420. See `25-mls.md` for the MLS integration binding.

## 20.10 Cryptographic distinctions

The following constructions MUST NOT be conflated:

```text
Ed25519          = signatures
X25519           = key agreement / KEM
AES-256-GCM      = general Loopable object encryption
HPKE             = standardized public-key encryption construction
MLS              = standardized dynamic group encryption
AES-128-GCM      = the AEAD used by the mandatory MLS 1.0 suite
```

That MLS uses AES-128-GCM does not mean ordinary Loopable objects use AES-128-GCM. Ordinary Loopable objects use AES-256-GCM.

## 20.11 Randomness

All cryptographically random values MUST be generated using a cryptographically secure random number generator appropriate for the host platform.

Values that require cryptographically secure randomness: account private keys, device private keys, instance private keys, event IDs, object IDs, device IDs, request IDs, object encryption keys, AES-GCM nonces, HPKE ephemeral keys, MLS key material, and other protocol-defined random values.

An implementation MUST NOT generate security-sensitive random values using timestamps, sequential counters alone, predictable pseudorandom generators, usernames, or hashes of predictable values.

## 20.12 Domain-separation labels

Every Loopable cryptographic construction uses an explicit domain-separation label. This module is the authoritative registry.

A label is the ASCII byte string given below, including the trailing `0x00` byte where shown, followed by the protocol data defined by the consuming module.

| Construction | Label (ASCII) | Consuming module |
| ------------ | ------------- | ---------------- |
| Account ID derivation | `loopable-account-id` `0x00` | `10-identifiers.md` |
| Instance ID derivation | `loopable-instance-id` `0x00` | `10-identifiers.md` |
| Event signature | `loopable-event-v1` `0x00` | `22-signatures.md` |
| First-device authorization signature | `loopable-first-device-authorization-v1` `0x00` | `22-signatures.md`, `34-event-types.md` |
| Object encryption AAD | `loopable-object-v1` `0x00` | `23-encryption.md`, `35-media-encryption.md` |
| Recipient key identifier | `loopable-recipient-key-id-v1` `0x00` | `24-hpke.md` |
| HPKE object-key wrapping | `loopable-hpke-object-key-v1` `0x00` | `24-hpke.md` |
| Object envelope identifier (derived) | `loopable-object-envelope-v1` `0x00` | `33-object-envelope.md` |
| Instance document signature | `loopable-instance-document-v1` `0x00` | `13-instances.md` |
| Federation request signature | `loopable-federation-request-v1` `0x00` | `61-federation-authentication.md` |
| MLS credential binding | `loopable-mls-credential-v1` `0x00` | `25-mls.md` |

An implementation MUST use the exact label bytes from this table. No other protocol purpose MAY reuse a registered label. Adding a new construction requires a new label registered here and MUST follow the extension process in `101-implementation-requirements.md`.

## 20.13 Algorithm agility

Protocol cryptographic algorithms are versioned. An implementation MUST NOT silently substitute another algorithm. Future cryptographic suites MUST receive explicit protocol identifiers, and the meaning of an existing encryption-suite identifier MUST never change, per `81-versioning-and-capabilities.md`.