# CONTRIBUTING.md

This repository contains the Loopable Protocol specification.

The protocol is meant to be implemented independently. If something in the spec is unclear enough that two developers could reasonably implement it differently, that's a problem with the spec.

## The spec

`spec/` is the source of truth for protocol behavior.

`schemas/`, `test-vectors/`, and `examples/` support the spec. They should stay consistent with it, but they don't define behavior on their own.

Keep protocol requirements explicit. Use:

* **MUST / MUST NOT** for requirements
* **SHOULD / SHOULD NOT** for strong recommendations
* **MAY** for optional behavior

Don't rely on the official Loopable implementation to explain something the protocol itself doesn't define.

## Changing the protocol

Use issues for discussion and PRs for changes to the spec.

For anything that changes protocol behavior, explain the problem first. The proposed solution can then be discussed and changed before it lands in the spec.

PRs should be focused. A PR should make one coherent change rather than combining unrelated protocol changes, formatting, refactoring, or cleanup.

Large changes are not automatically a problem, but their size should be justified by the change being made. A change that is difficult to review needs to provide enough value to justify that review.

Not every issue needs to turn into a feature. Removing ambiguity, simplifying something, or fixing a bad requirement are all valid protocol changes.

## Interoperability

Assume someone is implementing Loopable without looking at the official implementation.

The spec should tell them what they need to do.

Avoid things like:

> The server handles this normally.

Instead, define what the server actually does.

If a requirement could be interpreted in two different ways, fix the wording rather than expecting implementations to guess.

When useful, add a schema, test vector, or example to make the behavior unambiguous.

## Security and privacy

Loopable deals with encrypted social data, identities, devices, and federation. Changes in these areas need extra scrutiny.

Don't invent cryptography when an established standard can do the job.

When changing a security or privacy property, be clear about what is protected, who can access it, and what happens when keys, devices, or membership change.

Also consider metadata. Encrypting content does not automatically hide who sent it, where it went, or when it happened.

Don't put real private keys, credentials, or user data in issues, examples, or test vectors.

Security vulnerabilities should be reported through `SECURITY.md`.

## Compatibility

Be explicit about changes that could break existing implementations.

This includes changes to things like:

* Wire formats
* Identity and authentication
* Encryption and key management
* Object behavior
* Federation

Don't quietly introduce breaking behavior as part of an unrelated change.

The protocol's versioning rules live in the specification.

## Schemas, test vectors, and examples

Update `schemas/` when the structure of protocol data changes.

Add or update `test-vectors/` when behavior can be tested with known inputs and outputs. They're particularly useful for cryptography, serialization, signatures, and other deterministic operations.

Use `examples/` to show how the protocol works. Examples are informative and don't override the spec.

## PRs

Each PR should provide enough context for someone to understand and review the change.

A PR should have a clear title and a brief description of what it changes. It should also include a more detailed description explaining the change, why it is needed, and why the proposed approach should be merged.

Images, videos, diagrams, examples, or other supporting material can be included when they make the change easier to understand. They are not required.

Include anything else that is relevant to the change. For protocol work, this might include compatibility concerns, security or privacy implications, affected parts of the specification, test vectors, implementation details, or links to relevant discussions.

The PR should explain the reasoning behind the change clearly enough that reviewers do not have to reconstruct it from the diff alone.

When using AI tools or agents, the contributor is responsible for the resulting work. You should understand what was changed and be able to explain why it was changed.

Agents should not expand a task beyond its intended scope. If an agent rewrites unrelated parts of the specification, reformats the repository, changes terminology, or makes other changes that were not part of the task, remove those changes before submitting the PR.

Do not submit a large generated rewrite and expect reviewers to work out what changed, why it changed, or which parts actually matter.

## Commits

Use the [Conventional Commits](https://www.conventionalcommits.org/) format for commit messages.

The basic format is:

`type(scope): description`

The scope is optional.

Examples:

* `docs: clarify account discovery`
* `spec(identity): define device authentication`
* `fix(federation): reject invalid signatures`
* `feat(groups)!: change group membership semantics`

Use `!` or a `BREAKING CHANGE` footer when a commit introduces a breaking change.

Keep commit messages specific to the change being made.

## Disagreements

Technical disagreements are expected.

Argue about the protocol, not the person.

Good discussion usually comes down to things like:

* What problem are we solving?
* What behavior do we actually need?
* What does this expose?
* What does this break?
* How complicated does it make implementations?

A proposal doesn't need to be accepted just because it has an implementation. It also doesn't need to be rejected because the official implementation doesn't currently support it.

The spec comes first.

## The goal

Loopable should be implementable by someone who wasn't involved in writing it.

If an independent implementation can read the spec, implement the relevant behavior, and interoperate with another implementation, the spec is doing its job.
