# 0018: Media ciphertext is uploaded then bound to the object envelope

* Status: accepted
* Basis: `spec/35-media-encryption.md` 35.10, `spec/60-federation.md` 60.5, `spec/33-object-envelope.md` 33.3

## Context

Earlier `35.10` text was self-contradictory about how large media blobs reach the storing instance. One sentence required the client to "assemble the media object envelope in memory with the blob as its ciphertext value" and "submit the envelope to `POST /v1/objects`", which puts up to 2 GiB of ciphertext into an object-creation request body. The next sentence allowed the instance to "MAY bind the stored blob from a completed upload identified by metadata rather than stream the bytes a second time". Two implementers could honestly diverge: one submits full envelopes inline, the other uploads and binds. The blob-in-body reading also made the 8 MiB request body limit unworkable for media.

## Alternatives

1. Keep the full envelope inline in `POST /v1/objects`. Rejected: multi-gigabyte request bodies, resumable upload pointless for its main case, and the ambiguity above.
2. Make upload-then-bind the only account creation path. Chosen: the media blob travels through the tus endpoints when an account creates media at its own instance, and the object submission carries a transient `media_upload_submission` wrapper with empty `ciphertext` plus `upload_id` naming the finalized upload. Federated relay still sends the complete object envelope.
3. Add a separate "bind" endpoint distinct from `POST /v1/objects`. Rejected: the object submission is a natural place to bind, and a new authenticated endpoint would duplicate account- and instance-authentication logic already defined for `60.5`.

## Decision

Media ciphertext is transported with the tus resumable upload endpoints, finalized when the stored byte count reaches `Upload-Length`, and bound to the media object envelope at submission to `POST /v1/objects`. A media envelope submitted this way is carried inside `media_upload_submission`: the wrapped envelope has empty `ciphertext`, and the wrapper carries `upload_id` for the finalized upload. The instance verifies the upload exists, is finalized, and belongs to the submitting account, then binds its bytes as `ciphertext`. The bound envelope is the authoritative protocol object and federates normally.

## Consequences

* `POST /v1/objects` request bodies for media are small; the 8 MiB limit of `82.1` applies without a media exemption.
* There is exactly one creation path to implement, so two independent clients cannot diverge on how media is submitted.
* A tampered `upload_id` can at most bind a wrong or missing blob (denial for the author), never a confidentiality break: the blob is authenticated by the stream AEAD of `35.7`.
* Implementations that already read `spec/35.10` MUST be updated; the wire format of the media envelope itself is unchanged.
