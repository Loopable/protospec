# 92. Threat model

This module states the assumed attacker, the security properties, and the failure containment of Loopable 0.1.

## 92.1 Trust hierarchy

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

Instances sit beside this hierarchy, not above it: they store ciphertext, transport events, verify signatures, synchronize data, and apply local policy, but they MUST NOT control account identity.

## 92.2 Assumptions

The threat model assumes:

* cryptographic primitives are secure as standardized;
* clients protect their private keys per `90.2`;
* transport TLS is configured correctly per `13.8`;
* at least one authorized device of each account is uncompromised.

## 92.3 Attacker capabilities

An attacker may be:

* a malicious or compromised instance in the federation;
* a passive network observer;
* an active network attacker;
* a holder of a stolen private key (per the affected role);
* an unauthorized user probing the protocol.

Attainable by the attacker without user-device compromise: reading encrypted objects and key envelopes, reading metadata (`91.2`), forging nothing cryptographically (no account, device, or instance signatures unless key material is compromised).

## 92.4 Security properties

| Property | Statement | Module |
| -------- | --------- | ------ |
| Account authenticity | Only an authorized device can produce valid account events. | `42-identity-and-authorization.md` |
| Device authenticity | Devices are cryptographically authorized by the account's trust chain. | `41-device-lifecycle.md` |
| Content confidentiality | Instances store ciphertext rather than required plaintext. | `23-encryption.md`, `65-object-storage.md` |
| Object integrity | Authenticated encryption prevents undetected ciphertext modification. | `23-encryption.md` |
| Event integrity | Immutable signed events prevent silent historical modification. | `32-event-envelope.md` |
| Federation authenticity | Instances authenticate one another independently of TLS alone. | `61-federation-authentication.md` |
| Group security | MLS provides standardized dynamic group encryption. | `25-mls.md` |
| Failure containment | Compromising an instance does not automatically compromise account private keys. | `90.6` |

## 92.5 Not-protected

The protocol does not protect against: a compromised user device (`98` of the foundational draft); an instance operator who is also the user's only host refusing service; metadata collection by the infrastructure (`91.2`); or cryptographically strong coercion of the endpoint that holds keys.

## 92.6 Forward secrecy and post-compromise security

MLS groups obtain forward secrecy and post-compromise security according to RFC 9420 (`25.7`). Ordinary per-object encryption provides neither automatically; implementations MUST NOT advertise stronger guarantees than the construction provides.

## 92.7 Impossibility boundaries

* Sole trusted device lost: permanent account inaccessibility (`41.5`).
* Device revocation limited to future authorization (`41.4`).
* Server compromise limited to what the infrastructure already observes (`91.3`).
* Account identity replacement: never valid (`42.7`).