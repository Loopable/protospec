# 71. Search

This module defines the boundaries of search.

## 71.1 Contextual search

Search is contextual. A client MUST NOT perform unrestricted global account search. A global user directory does not exist in the protocol (`91-privacy.md`, `13.7`).

A public profile (`51.5`) enables an individual direct lookup by account identifier or handle, not a search listing. Public accounts MUST NOT be indexed for global search, and their public status does not permit enumeration (`13.7`).

Search MAY operate over:

* the user's current instance;
* contexts the user belongs to;
* locally available authorized content.

A client MUST NOT be able to perform `search("every Loopable user")` through the base protocol.

## 71.2 Server versus client indexing

Search indexes SHOULD be built from decrypted client-side data where privacy requirements make server-side indexing inappropriate. The enrollment and privacy consequences of server-side indexing are the operator's responsibility and MUST NOT undermine encryption, per `91-privacy.md`.

## 71.3 Scope enforcement

An instance providing search MUST scope every query to the requesting member's own instance membership and contexts. It MUST NOT leak results the requester is not authorized to see. Encrypted-search mechanisms MAY be provided in future protocol versions; version 0.1 does not assume them.

## 71.4 Rate limits

Search endpoints are group-10 rate-limited (`82-limits-and-validation.md`). Search results MUST NOT include decryption keys or key material of any kind.