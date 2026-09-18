# 90. Security

This module is the authoritative statement of security requirements.

## 90.1 Cryptographic implementation requirements

Cryptographic implementations SHOULD use constant-time primitives provided by mature cryptographic libraries. Implementations SHOULD avoid custom AES, Ed25519, X25519, or GCM implementations unless there is a compelling expert-reviewed reason.

The preferred strategy is audited libraries supporting Ed25519, X25519, AES-GCM, HKDF, HPKE, and MLS. Implementations MUST NOT implement these primitives from their mathematical definitions inside application code unless the code is itself the specialized library.

## 90.2 Private-key protection

Private keys MUST NOT be written to ordinary plaintext application logs, analytics, crash reports, federation requests, debug output, test fixtures, or Git repositories. Private keys SHOULD be stored using OS-backed secure storage. Sensitive local state MUST be protected by the platform's secure storage mechanisms where available.

## 90.3 Secure randomness

All cryptographically random values are generated per `20.11`. No security-sensitive value MAY be derived from timestamps, counters, predictable PRNGs, names, or hashes of predictable values.

## 90.4 Cryptographic failure behavior

* If decryption fails because authentication fails, the implementation MUST treat the ciphertext as invalid. It MUST NOT attempt alternative keys indefinitely and MUST NOT silently ignore authentication failures.
* AES-GCM authentication failure MUST NOT return partially decrypted plaintext.
* HPKE authentication failure MUST be treated as a failed decryption (`24.7`).
* MLS validation failures MUST follow RFC 9420.
* Signature verification failures MUST follow `22.6`.

## 90.5 Logging

* Instances MUST NOT log plaintext encrypted-object contents.
* Instances SHOULD avoid logging decrypted data, private key material, complete social graphs, and unnecessary account metadata.
* Security-sensitive identifiers SHOULD be redacted where practical.

## 90.6 Compromise handling

* Server compromise: an attacker who compromises an instance database SHOULD obtain at most encrypted objects, encrypted key envelopes, signed events, protocol metadata, and retained operational metadata. The attacker MUST NOT automatically obtain plaintext social content from the database alone. This depends on clients protecting private keys.
* Client compromise: a compromised trusted device exposes plaintext and key material held by that device. The protocol cannot provide confidentiality against a fully compromised endpoint that legitimately possesses decryption keys. Device revocation limits future authorization after compromise is detected (`41.4`).
* Instance compromise: compromising an instance MUST NOT permit forging another instance's cryptographic identity unless the instance root key is compromised. Operational-key compromise SHOULD be recoverable through instance-document rotation (`13.3.4`).
* Trusted-device loss: per `41.5`, if the sole trusted device is lost, the account is permanently inaccessible; no recovery MUST be provided.

## 90.7 Key destruction and cryptographic deletion

Clients SHOULD destroy encryption keys that are no longer required, especially for private messages, deleted posts, revoked group members, deleted groups, and expired content (`21.9`). Cryptographic deletion makes ciphertext undecryptable even when physical ciphertext remains, per `65.6`. No implementation MAY claim guaranteed physical erasure from every replica because a deletion event was created.

## 90.8 Security classifications

Protocol extensions SHOULD classify operations as `CLIENT_ONLY`, `INSTANCE_VERIFIABLE`, `FEDERATION_VERIFIABLE`, or `INSTANCE_PLAINTEXT_REQUIRED`. `INSTANCE_PLAINTEXT_REQUIRED` SHOULD be avoided for normal social data. An extension that requires instance plaintext MUST declare that classification explicitly per `101-implementation-requirements.md`.

## 90.9 Aliveness and freshness

Federation requests carry a timestamp and request id and MUST satisfy `61.5`. The freshness window is normative (`82.1`). Instances MUST retain replay state for at least the window, per `61.7`.

## 90.10 Security review gates

The following MUST have been completed and published: a security audit of the cryptographic composition, a security review of federation authentication (`61-federation-authentication.md`), a metadata and privacy analysis (`91-privacy.md`), and a downgrade and compatibility analysis (`81-versioning-and-capabilities.md`). These are tracked as developer requirements in `101-implementation-requirements.md`.