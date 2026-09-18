# 0017: Instance metadata is public and moderation is instance-local

* Status: accepted
* Basis: `spec/13-instances.md` 13.3.1 and 13.10, `spec/65-object-storage.md` 65.10, `spec/56-media-and-files.md` 56.3

## Context

The protocol had no public instance profile beyond the cryptographic instance document, and no defined moderation model: staff roles and enforcement were entirely out of scope. Users want to know who runs an instance, what the rules are, and whether a given account is staff, and they want instances to be able to ban, kick, and restrict accounts without inventing ad-hoc extensions.

## Alternatives

1. Put `administrator`, `domain`, `description`, and `rules` in the signed instance document, and define instance-local moderation roles enforced by the instance. Chosen.
2. Keep instance metadata as a separate out-of-band configuration, and leave moderation entirely unaddressed. Rejected: the spec would have no interoperable role or enforcement language.
3. Define instance-level role events signed by instance keys. Rejected: the protocol currently has no instance-signed event model, and roles are enforced by the hosting instance, not by the global graph.

## Decision

The instance document (`13.3.1`) now carries the administrator account, the canonical hostname, an optional human-readable description, and an optional flat list of rule strings; the root signature binds the metadata at the time of publication. Moderation is instance-local: the administrator appoints moderators; moderators may ban (remove and prevent rejoin), kick (remove), mute (restrict to read-only), or suspend (deny all access for a bounded interval that releases automatically, max 365 days); and roles are published through a public roles endpoint and disclosed in account lookups. Media files are stripped of EXIF, location, camera, and device metadata on upload (`56.3`), and the object storage backend should be an S3-compatible object store (`65.10`).

## Consequences

* Anyone can see who runs an instance and what its stated rules are, authenticated by the instance root signature.
* Staff authority never leaves the instance: being a moderator on one instance has no effect on another instance, and staff roles never grant decryption access.
* Metadata stripping on upload is now a MUST, not a SHOULD, closing a privacy gap around image and video uploads.
* Using an S3-compatible object store is a SHOULD deployment choice; the protocol is not tied to one storage implementation.