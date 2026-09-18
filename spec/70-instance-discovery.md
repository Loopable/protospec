# 70. Instance discovery

This module defines the boundary between protocol operation and instance discovery.

## 70.1 Discovery is not the protocol

Instance discovery is explicitly not part of the Loopable Protocol. It is an optional service.

The official Loopable client MAY use a centralized instance-discovery service. That service MAY publish instance lists, descriptions, capacity information, operator policies, protocol versions, and abuse or security contacts.

The disappearance of the discovery service MUST NOT prevent protocol interoperability.

## 70.2 Unlisted by default

Instances are unlisted by default. Any compatible implementation MAY operate an unlisted instance. Users MAY connect directly to an instance URL. A discovery directory is not a trust root.

## 70.3 Directory trust model

A discovery service MUST NOT be treated as the cryptographic authority for an instance. The client MUST independently verify the instance's cryptographic identity from its instance document and root signature (`61-federation-authentication.md`).

A discovery service MAY publish metadata describing an instance. It MUST NOT be necessary for validating account signatures, device signatures, instance signatures, encrypted objects, or event authenticity (`22-signatures.md`, `23-encryption.md`).

## 70.4 Directory review

A foundation-operated discovery directory MAY review applications using objective listing criteria, such as instance domain, operator contact, intended community, moderation policy, privacy policy, federation policy, terms, protocol version, security contact, capacity, abuse contact, and instance cryptographic identity.

The directory MUST NOT become a global protocol authority. An unlisted instance remains a valid Loopable instance if it implements the protocol.