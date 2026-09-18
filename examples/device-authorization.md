# Example: device authorization and revocation

This example shows the trusted-device flow and a device handover, in the sequence an implementation exercises.

## Setup

Alice's account exists at `instance.social` with one client `dv_alpha` (trusted, authorized). She adds a backup device `dv_backup` over a pairing channel, and later replaces her laptop.

## 1. Device record

`dv_alpha` publishes a device authorization for `dv_backup` (`spec/34-event-types.md` 34.4):

```text
DEVICE_AUTHORIZED(1) signed by dv_alpha:
  0 device_id     : dv_backup (16 bytes)
  1 signing_pubkey: S_backup
  2 encryption_pub: E_backup (X25519)
  3 device_kind   : 1  (backup)
  4 display_name  : "backup-vault"
```

`dv_backup` is authorized (can read account objects whose recipient records name it) but is NOT trusted (cannot transfer trust). Trusted sync from `dv_backup` yields the account event history and all objects addressed to it.

## 2. Trusted-device transfer

Alice's laptop is stolen. On her backup device, she verifies the transfer procedure and publishes the one-step handover (`spec/41-device-lifecycle.md` 41.4, event type 3):

```text
TRUSTED_DEVICE_TRANSFERRED(3) signed by the current trusted device dv_alpha
  (from a pre-signed transfer authorization carried by dv_backup, or by
   re-authorizing dv_backup as trusted through the pairing proof):

  0 new_trusted_device_id : dv_backup
```

After validation, `dv_backup` is the trusted device. `dv_alpha` loses the trusted role but may remain authorized; its old signing key can no longer authorize devices, and its recipient records are no longer created for future objects.

## 3. Revocation

Alice revokes the stolen laptop from `dv_backup`:

```text
DEVICE_REVOKED(2) signed by dv_backup:
  0 device_id : dv_alpha
  1 reason    : 1   (lost-device; spec 34.12)
```

`dv_alpha` is now unauthorized. Its signing key is added to the device-signed revocation set; instances MUST reject its event signatures (`spec/42-identity-and-authorization.md` 42.3).

## 4. What the instance does not see

The instance stores the new device's encryption public key and the recipient records. It never holds `E_backup`'s private half. It cannot read the account's past or future object plaintexts, and it cannot manufacture signatures for either device.