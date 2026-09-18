# Example: group creation and join

This example sketches group lifecycle with MLS, per `spec/25-mls.md` and `spec/53-contexts-and-membership.md`.

## Setup

Alice, Bob, and Carol each have accounts. Alice creates a group.

## 1. GROUP_CREATED

```text
GROUP_CREATED(17) from Alice:
  0 group_id : 101-group-a (16 bytes)
  1 name     : {0: <group_metadata object_id>, 1: <version_id>}
                (object_reference to the group_metadata object version)

  object references: [ the same group_metadata object, content {0:"design review"} ]
```

Alice waits for MLS encryption keys to be established before adding members. The first MLS key package is the group's own init, per `spec/25-mls.md` 25.5.

## 2. Group join (Bob)

Bob discovers the group by invite. He must prove membership before he can see the epoch:

```text
GROUP_JOINED(21) from Bob (on Bob's account):
  0 group_id : 101-group-a
  1 epoch    : 1

  references: [ mls_message object containing Bob's
                Welcome message and KeyPackage add to epoch 1 ]

GROUP_MEMBER_ADDED(19) from Alice:
  0 group_id       : 101-group-a
  1 epoch          : 1
  2 member_account_id: Bob
  3 member_device_id : (empty; whole account)
```

## 3. Epoch advance and messaging

`GROUP_UPDATED(23)` marks epoch advances as account events so group history is auditable (`spec/34-event-types.md` 34.11). Group messages travel as `MESSAGE_CREATED(24)` events referencing `mls_message` objects (`spec/54-messaging.md` 54.3):

```text
MESSAGE_CREATED(24) from Alice:
  0 context : 101-group-a
  references: [ mls_message object addressed to the MLS group ]
```

## 4. Leave

```text
GROUP_LEFT(22) from Bob:  {0: 101-group-a, 1: epoch}
```

History before the leave remains present. Bob removes himself with an MLS Remove proposal first; the epoch advance excludes his key package.