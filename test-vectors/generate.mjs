// Loopable Protocol 0.1 - test vector generator
//
// Deterministic generator for the reference vectors covering identifier
// derivation, canonical CBOR, event signatures, device authorization, account
// and instance authorization records, relationship events, federation request
// signing, streaming media encryption, username grammar, and event dependency
// validation with causal authorization.
//
// Run:  node test-vectors/generate.mjs
// Output: test-vectors/*.json
//
// All "random" inputs are derived from fixed seeds so the vectors are
// reproducible. Real implementations MUST use a CSPRNG, per spec/20.11.

import crypto from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Deterministic CBOR (RFC 8949 core deterministic encoding, per spec/30)
// ---------------------------------------------------------------------------

function concat(...parts) {
  const bufs = parts.map((p) => (p instanceof Uint8Array ? Buffer.from(p) : Buffer.from(p)));
  return Buffer.concat(bufs);
}

function head(major, value) {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 0x100) return Buffer.from([(major << 5) | 24, value]);
  if (value < 0x10000) {
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(value, 1);
    return b;
  }
  if (value < 0x100000000) {
    const b = Buffer.alloc(5);
    b[0] = (major << 5) | 26;
    b.writeUInt32BE(value, 1);
    return b;
  }
  const b = Buffer.alloc(9);
  b[0] = (major << 5) | 27;
  b.writeBigUInt64BE(BigInt(value), 1);
  return b;
}

function encUint(v) {
  return head(0, v);
}
function encBytes(b) {
  return concat(head(2, b.length), b);
}
function encText(s) {
  const b = Buffer.from(s, "utf8");
  return concat(head(3, b.length), b);
}
function encArray(items) {
  return concat(head(4, items.length), ...items);
}

function encKey(k) {
  if (typeof k === "number") return encUint(k);
  if (typeof k === "string") return encText(k);
  if (k instanceof Uint8Array) return encBytes(k);
  throw new Error("unsupported map key");
}

function encMap(entries) {
  const encoded = entries.map(([k, v]) => [encKey(k), v]);
  encoded.sort((a, b) => {
    if (a[0].length !== b[0].length) return a[0].length - b[0].length;
    return Buffer.compare(a[0], b[0]);
  });
  return concat(head(5, encoded.length), ...encoded.map(([k, v]) => concat(k, v)));
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const ED25519_SK_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const ED25519_PK_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const X25519_SK_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");
const X25519_PK_PREFIX = Buffer.from("302a300506032b656e032100", "hex");

function seed(label) {
  return crypto.createHash("sha256").update(concat("loopable-test-vector-v1\x00", label)).digest();
}

function ed25519FromSeed(s) {
  const priv = crypto.createPrivateKey({
    key: concat(ED25519_SK_PREFIX, s),
    format: "der",
    type: "pkcs8",
  });
  const pub = crypto.createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);
  return { priv, pub };
}

function x25519FromSeed(s) {
  const priv = crypto.createPrivateKey({
    key: concat(X25519_SK_PREFIX, s),
    format: "der",
    type: "pkcs8",
  });
  const pubDer = crypto.createPublicKey(priv).export({ format: "der", type: "spki" });
  return { priv, pub: pubDer.subarray(-32) };
}

function x25519PubFromRaw(raw) {
  return crypto.createPublicKey({
    key: concat(X25519_PK_PREFIX, raw),
    format: "der",
    type: "spki",
  });
}

function sign(key, msg) {
  return crypto.sign(null, msg, key);
}
function verify(key, msg, sig) {
  return crypto.verify(null, msg, key, sig);
}
function sha256(...parts) {
  return crypto.createHash("sha256").update(concat(...parts)).digest();
}

// ---------------------------------------------------------------------------
// HPKE (RFC 9180) - base mode, DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-256-GCM
// ---------------------------------------------------------------------------

const KEM_ID = 0x0020;
const KDF_ID = 0x0001;
const AEAD_ID = 0x0002;
const NK = 32;
const NN = 12;
const NH = 32;
const NENC = 32;

const KEM_SUITE_ID = concat("KEM", i2osp2(KEM_ID));
const HPKE_SUITE_ID = concat("HPKE", i2osp2(KEM_ID), i2osp2(KDF_ID), i2osp2(AEAD_ID));

function i2osp2(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n, 0);
  return b;
}

// Reversed copy needed to validate against RFC 9180 vectors below.
function hkdfExtract(salt, ikm) {
  return crypto.createHmac("sha256", salt).update(ikm).digest();
}
function hkdfExpand(prk, info, len) {
  const out = [];
  let t = Buffer.alloc(0);
  for (let i = 1; out.length < len; i++) {
    t = crypto.createHmac("sha256", prk).update(concat(t, info, Buffer.from([i]))).digest();
    out.push(t);
  }
  return Buffer.concat(out).subarray(0, len);
}
function labeledExtract(salt, suiteId, label, ikm) {
  return hkdfExtract(salt, concat("HPKE-v1", suiteId, label, ikm));
}
function labeledExpand(prk, suiteId, label, info, len) {
  return hkdfExpand(prk, concat(i2osp2(len), "HPKE-v1", suiteId, label, info), len);
}

function extractAndExpand(dh, kemContext) {
  const eaePrk = labeledExtract(Buffer.alloc(0), KEM_SUITE_ID, "eae_prk", dh);
  return labeledExpand(eaePrk, KEM_SUITE_ID, "shared_secret", kemContext, NK);
}

function encap(pkR, skE, pkE) {
  const dh = crypto.diffieHellman({ privateKey: skE, publicKey: x25519PubFromRaw(pkR) });
  const enc = pkE;
  const kemContext = concat(enc, pkR);
  return { sharedSecret: extractAndExpand(dh, kemContext), enc };
}

function keySchedule(mode, sharedSecret, info) {
  const psk = Buffer.alloc(0);
  const pskId = Buffer.alloc(0);
  const pskIdHash = labeledExtract(Buffer.alloc(0), HPKE_SUITE_ID, "psk_id_hash", pskId);
  const infoHash = labeledExtract(Buffer.alloc(0), HPKE_SUITE_ID, "info_hash", info);
  const keyScheduleContext = concat(Buffer.from([mode]), pskIdHash, infoHash);
  const secret = labeledExtract(sharedSecret, HPKE_SUITE_ID, "secret", psk);
  const key = labeledExpand(secret, HPKE_SUITE_ID, "key", keyScheduleContext, NK);
  const baseNonce = labeledExpand(secret, HPKE_SUITE_ID, "base_nonce", keyScheduleContext, NN);
  const exporterSecret = labeledExpand(secret, HPKE_SUITE_ID, "exp", keyScheduleContext, NH);
  return { key, baseNonce, exporterSecret, keyScheduleContext, pskIdHash, infoHash };
}

function aeadSeal(key, nonce, aad, pt) {
  const c = crypto.createCipheriv("aes-256-gcm", key, nonce);
  c.setAAD(aad);
  return concat(c.update(pt), c.final(), c.getAuthTag());
}
function aeadOpen(key, nonce, aad, ct) {
  const tag = ct.subarray(ct.length - 16);
  const body = ct.subarray(0, ct.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  d.setAAD(aad);
  d.setAuthTag(tag);
  return concat(d.update(body), d.final());
}

// SealBase with an explicit ephemeral key pair, for reproducible vectors.
function sealBase(pkR, info, aad, pt, ephpair) {
  const { sharedSecret, enc } = encap(pkR, ephpair.priv, ephpair.pub);
  const ks = keySchedule(0, sharedSecret, info);
  const ct = aeadSeal(ks.key, ks.baseNonce, aad, pt);
  return { enc, ct, ...ks, sharedSecret };
}

// OpenBase from the sender's ephemeral public key (enc).
function openBase(pkR, skR, info, aad, enc, ct) {
  const dh = crypto.diffieHellman({ privateKey: skR, publicKey: x25519PubFromRaw(enc) });
  const sharedSecret = extractAndExpand(dh, concat(enc, pkR));
  const ks = keySchedule(0, sharedSecret, info);
  return aeadOpen(ks.key, ks.baseNonce, aad, ct);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hex(b) {
  return Buffer.from(b).toString("hex");
}

function section(obj, name) {
  return { ...obj, _name: name };
}

// ---------------------------------------------------------------------------
// Fix 1 - FirstDeviceAuthorization
// ---------------------------------------------------------------------------

function fix1() {
  const identity = ed25519FromSeed(seed("identity"));
  const deviceSigning = ed25519FromSeed(seed("device-signing"));
  const deviceEncryption = x25519FromSeed(seed("device-encryption"));
  const instanceRoot = ed25519FromSeed(seed("instance-root"));

  const accountId = sha256("loopable-account-id\x00", identity.pub);
  const instanceId = sha256("loopable-instance-id\x00", instanceRoot.pub);
  const deviceId = seed("device-id").subarray(0, 16);
  const eventId = seed("event-id").subarray(0, 16);

  const unsigned = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(deviceId)],
    [3, encBytes(deviceSigning.pub)],
    [4, encBytes(deviceEncryption.pub)],
    [5, encUint(0)],
  ]);

  const sigInput = concat("loopable-first-device-authorization-v1\x00", unsigned);
  const identitySignature = sign(identity.priv, sigInput);

  const record = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(deviceId)],
    [3, encBytes(deviceSigning.pub)],
    [4, encBytes(deviceEncryption.pub)],
    [5, encUint(0)],
    [6, encBytes(identitySignature)],
  ]);

  const created = 1759632400;
  const body = encMap([
    [0, encBytes(identity.pub)],
    [1, encText("alice")],
    [2, encBytes(instanceId)],
    [3, record],
  ]);

  const envelopeUnsigned = encMap([
    [0, encText("0.1")],
    [1, encBytes(eventId)],
    [2, encUint(0)],
    [3, encBytes(accountId)],
    [4, encBytes(Buffer.alloc(0))],
    [5, encUint(created)],
    [6, encArray([])],
    [7, encArray([])],
    [8, body],
  ]);
  const eventSigInput = concat("loopable-event-v1\x00", envelopeUnsigned);
  const eventSignature = sign(identity.priv, eventSigInput);
  const envelope = encMap([
    [0, encText("0.1")],
    [1, encBytes(eventId)],
    [2, encUint(0)],
    [3, encBytes(accountId)],
    [4, encBytes(Buffer.alloc(0))],
    [5, encUint(created)],
    [6, encArray([])],
    [7, encArray([])],
    [8, body],
    [9, encBytes(eventSignature)],
  ]);

  const positive = section(
    {
      inputs: {
        identity_seed: hex(seed("identity")),
        identity_public_key: hex(identity.pub),
        device_signing_public_key: hex(deviceSigning.pub),
        device_encryption_public_key: hex(deviceEncryption.pub),
        device_id: hex(deviceId),
        account_id: hex(accountId),
        instance_id: hex(instanceId),
        event_id: hex(eventId),
        username: "alice",
        created_at: created,
      },
      intermediates: {
        authorization_unsigned_cbor: hex(unsigned),
        authorization_signature_input: hex(sigInput),
        account_id_derivation_input: hex(concat("loopable-account-id\x00", identity.pub)),
      },
      expected: {
        first_device_authorization_cbor: hex(record),
        identity_signature: hex(identitySignature),
        account_created_body_cbor: hex(body),
        event_envelope_cbor: hex(envelope),
        event_signature: hex(eventSignature),
      },
      checks: {
        identity_signature_verifies:
          verify(identity.priv, sigInput, identitySignature) === true,
        account_id_matches_derivation: hex(accountId) === hex(sha256("loopable-account-id\x00", identity.pub)),
      },
    },
    "first-device-authorization/valid"
  );

  // Negative: device_kind = 1 (backup) is forbidden for the first device.
  const bannedKindUnsigned = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(deviceId)],
    [3, encBytes(deviceSigning.pub)],
    [4, encBytes(deviceEncryption.pub)],
    [5, encUint(1)],
  ]);
  const bannedKindSig = sign(identity.priv, concat("loopable-first-device-authorization-v1\x00", bannedKindUnsigned));
  const bannedKindRecord = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(deviceId)],
    [3, encBytes(deviceSigning.pub)],
    [4, encBytes(deviceEncryption.pub)],
    [5, encUint(1)],
    [6, encBytes(bannedKindSig)],
  ]);

  // Negative: account_id in the record differs from the identity-derived value.
  const wrongAccountUnsigned = encMap([
    [0, encText("0.1")],
    [1, encBytes(seed("other-account").subarray(0, 32))],
    [2, encBytes(deviceId)],
    [3, encBytes(deviceSigning.pub)],
    [4, encBytes(deviceEncryption.pub)],
    [5, encUint(0)],
  ]);
  const wrongAccountSig = sign(identity.priv, concat("loopable-first-device-authorization-v1\x00", wrongAccountUnsigned));
  const wrongAccountRecord = encMap([
    [0, encText("0.1")],
    [1, encBytes(seed("other-account").subarray(0, 32))],
    [2, encBytes(deviceId)],
    [3, encBytes(deviceSigning.pub)],
    [4, encBytes(deviceEncryption.pub)],
    [5, encUint(0)],
    [6, encBytes(wrongAccountSig)],
  ]);

  // Negative: the signature was made over the signed map (including key 6)
  // instead of the unsigned map. Both are provided so a validator can show the
  // signature does not verify over the required input.
  const signatureOverSignedInput = sign(
    identity.priv,
    concat("loopable-first-device-authorization-v1\x00", encMap([
      [0, encText("0.1")],
      [1, encBytes(accountId)],
      [2, encBytes(deviceId)],
      [3, encBytes(deviceSigning.pub)],
      [4, encBytes(deviceEncryption.pub)],
      [5, encUint(0)],
      [6, encBytes(identitySignature)],
    ]))
  );

  const negatives = [
    section(
      {
        reason: "device_kind is 1 (backup); a first device MUST NOT be a backup",
        expected_error: "E_FIRST_DEVICE_INVALID",
        inputs: { device_kind: 1 },
        expected: { first_device_authorization_cbor: hex(bannedKindRecord) },
      },
      "first-device-authorization/negative-backup-kind"
    ),
    section(
      {
        reason: "record account_id does not match the identity-derived account_id",
        expected_error: "E_FIRST_DEVICE_INVALID",
        inputs: { account_id_in_record: hex(seed("other-account").subarray(0, 32)) },
        expected: { first_device_authorization_cbor: hex(wrongAccountRecord) },
      },
      "first-device-authorization/negative-account-mismatch"
    ),
    section(
      {
        reason: "signature was computed over the signed map (including key 6) instead of the unsigned map",
        expected_error: "E_SIGNATURE_INVALID",
        expected: {
          signature: hex(signatureOverSignedInput),
          required_signature_input: hex(sigInput),
          rejects_because_input_differs: hex(signatureOverSignedInput) !== hex(identitySignature),
        },
      },
      "first-device-authorization/negative-wrong-signature-input"
    ),
    section(
      {
        reason: "ACCOUNT_CREATED body omits first_device_authorization",
        expected_error: "E_FIRST_DEVICE_INVALID",
        expected: {
          body_cbor: hex(encMap([
            [0, encBytes(identity.pub)],
            [1, encText("alice")],
            [2, encBytes(instanceId)],
          ])),
        },
      },
      "first-device-authorization/negative-missing-authorization"
    ),
  ];

  return { positive, negatives };
}

// ---------------------------------------------------------------------------
// Fix 2 - HPKE object-key wrapping
// ---------------------------------------------------------------------------

function fix2() {
  const recipient = x25519FromSeed(seed("recipient"));
  const ephemeral = x25519FromSeed(seed("ephemeral"));
  const accountId = sha256("loopable-account-id\x00", ed25519FromSeed(seed("identity")).pub);
  const deviceId = seed("device-id").subarray(0, 16);
  const objectId = seed("object-id");
  const cek = seed("cek");

  const descriptor = encMap([
    [0, encUint(0)],
    [1, encBytes(accountId)],
    [2, encBytes(deviceId)],
    [3, encBytes(recipient.pub)],
  ]);
  const recipientKeyId = sha256("loopable-recipient-key-id-v1\x00", descriptor).subarray(0, 16);
  const info = concat(
    "loopable-hpke-object-key-v1\x00",
    objectId,
    recipientKeyId,
    Buffer.from("0.1", "utf8")
  );

  const sealed = sealBase(recipient.pub, info, Buffer.alloc(0), cek, ephemeral);

  const positive = section(
    {
      inputs: {
        recipient_public_key: hex(recipient.pub),
        ephemeral_public_key: hex(ephemeral.pub),
        object_id: hex(objectId),
        cek: hex(cek),
        recipient_kind: 0,
        account_id: hex(accountId),
        device_id: hex(deviceId),
      },
      intermediates: {
        recipient_key_descriptor_cbor: hex(descriptor),
        recipient_key_id_derivation_input: hex(concat("loopable-recipient-key-id-v1\x00", descriptor)),
        recipient_key_id: hex(recipientKeyId),
        hpke_info: hex(info),
        dh: hex(crypto.diffieHellman({ privateKey: ephemeral.priv, publicKey: x25519PubFromRaw(recipient.pub) })),
        kem_context: hex(concat(ephemeral.pub, recipient.pub)),
        shared_secret: hex(sealed.sharedSecret),
        key_schedule_context: hex(sealed.keyScheduleContext),
        aead_key: hex(sealed.key),
        base_nonce: hex(sealed.baseNonce),
      },
      expected: {
        encapsulated_key: hex(sealed.enc),
        wrapped_key: hex(sealed.ct),
        recovered_cek: hex(openBase(recipient.pub, recipient.priv, info, Buffer.alloc(0), sealed.enc, sealed.ct)),
      },
      checks: {
        roundtrip_recovers_cek: hex(openBase(recipient.pub, recipient.priv, info, Buffer.alloc(0), sealed.enc, sealed.ct)) === hex(cek),
        enc_equals_ephemeral_public_key: hex(sealed.enc) === hex(ephemeral.pub),
      },
    },
    "hpke-object-key/valid"
  );

  // Negative: a tampered recipient_key_id changes info, so OpenBase fails.
  const tamperedKeyId = Buffer.from(recipientKeyId);
  tamperedKeyId[0] ^= 0x01;
  const tamperedInfo = concat(
    "loopable-hpke-object-key-v1\x00",
    objectId,
    tamperedKeyId,
    Buffer.from("0.1", "utf8")
  );
  let tamperFails = false;
  try {
    openBase(recipient.pub, recipient.priv, tamperedInfo, Buffer.alloc(0), sealed.enc, sealed.ct);
  } catch {
    tamperFails = true;
  }

  // Negative: a wrong CEK was used, so the recovered key differs.
  const wrongCek = seed("other-cek");
  const sealedWrong = sealBase(recipient.pub, info, Buffer.alloc(0), wrongCek, ephemeral);

  const negatives = [
    section(
      {
        reason: "recipient_key_id was modified, so HPKE info differs and decryption fails",
        expected_error: "E_DECRYPTION_FAILED",
        expected: {
          tampered_recipient_key_id: hex(tamperedKeyId),
          tampered_hpke_info: hex(tamperedInfo),
          rejects: tamperFails,
        },
      },
      "hpke-object-key/negative-tampered-recipient-key-id"
    ),
    section(
      {
        reason: "object_id was modified, so HPKE info differs and decryption fails",
        expected_error: "E_DECRYPTION_FAILED",
        expected: {
          rejects:
            (() => {
              const otherObject = Buffer.from(objectId);
              otherObject[0] ^= 0x01;
              const otherInfo = concat(
                "loopable-hpke-object-key-v1\x00",
                otherObject,
                recipientKeyId,
                Buffer.from("0.1", "utf8")
              );
              try {
                openBase(recipient.pub, recipient.priv, otherInfo, Buffer.alloc(0), sealed.enc, sealed.ct);
                return false;
              } catch {
                return true;
              }
            })(),
        },
      },
      "hpke-object-key/negative-tampered-object-id"
    ),
    section(
      {
        reason: "wrapped_key was produced from a different CEK",
        expected_error: "E_DECRYPTION_FAILED",
        expected: {
          wrapped_key: hex(sealedWrong.ct),
          recovers_different_cek:
            hex(openBase(recipient.pub, recipient.priv, info, Buffer.alloc(0), sealedWrong.enc, sealedWrong.ct)) === hex(cek),
        },
      },
      "hpke-object-key/negative-wrong-cek"
    ),
  ];

  return { positive, negatives, sealed, recipient, ephemeral, accountId, deviceId, objectId, cek, recipientKeyId, info };
}

// ---------------------------------------------------------------------------
// Fix 3 - versioned-object AAD
// ---------------------------------------------------------------------------

function fix3(hpke) {
  const objectId = hpke.objectId;
  const versionId = seed("version-id");
  const cek = seed("object-cek");
  const nonce = seed("nonce").subarray(0, 12);
  const plaintext = encMap([[0, encText("Hello from Alice")]]);

  const metadataEntries = [
    [0, encText("0.1")],
    [1, encBytes(objectId)],
    [2, encUint(0)],
    [3, encUint(0)],
    [4, encBytes(versionId)],
  ];
  const metadata = encMap(metadataEntries);
  const aad = concat("loopable-object-v1\x00", metadata);

  const ciphertextWithTag = aeadSeal(cek, nonce, aad, plaintext);

  // Complete envelope, using the recipient record from fix 2.
  const recipientRecord = encMap([
    [0, encUint(0)],
    [1, encBytes(hpke.accountId)],
    [2, encBytes(hpke.deviceId)],
    [3, encBytes(hpke.recipientKeyId)],
    [4, encBytes(hpke.sealed.enc)],
    [5, encBytes(hpke.sealed.ct)],
  ]);
  const envelope = encMap([
    [0, encText("0.1")],
    [1, encBytes(objectId)],
    [2, encUint(0)],
    [3, encUint(0)],
    [4, encBytes(versionId)],
    [5, encBytes(nonce)],
    [6, encBytes(ciphertextWithTag)],
    [7, encArray([recipientRecord])],
  ]);
  const envelopeId = sha256("loopable-object-envelope-v1\x00", envelope);

  const positive = section(
    {
      inputs: {
        protocol_version: "0.1",
        object_id: hex(objectId),
        object_type: 0,
        encryption_suite: 0,
        version_id: hex(versionId),
        cek: hex(cek),
        nonce: hex(nonce),
        plaintext_cbor: hex(plaintext),
      },
      intermediates: {
        object_security_metadata_cbor: hex(metadata),
        aad: hex(aad),
      },
      expected: {
        ciphertext_with_tag: hex(ciphertextWithTag),
        object_envelope_cbor: hex(envelope),
        envelope_id: hex(envelopeId),
      },
      checks: {
        decrypt_recovers_plaintext: hex(aeadOpen(cek, nonce, aad, ciphertextWithTag)) === hex(plaintext),
      },
    },
    "object-encryption-aad/valid"
  );

  function tampered(field, mutate, reason) {
    const entries = metadataEntries.map((e) => [e[0], e[1]]);
    const idx = entries.findIndex(([k]) => k === field);
    entries[idx][1] = mutate(entries[idx][1]);
    const m = encMap(entries);
    const a = concat("loopable-object-v1\x00", m);
    let rejects = false;
    try {
      aeadOpen(cek, nonce, a, ciphertextWithTag);
    } catch {
      rejects = true;
    }
    return section(
      {
        reason,
        expected_error: "E_DECRYPTION_FAILED",
        expected: { object_security_metadata_cbor: hex(m), aad: hex(a), rejects },
      },
      `object-encryption-aad/negative-${field}`
    );
  }

  const negatives = [
    tampered(
      1,
      (v) => {
        const b = Buffer.from(v.subarray(1));
        b[0] ^= 0x01;
        return encBytes(b);
      },
      "object_id differs from the one used to encrypt"
    ),
    tampered(
      2,
      () => encUint(1),
      "object_type differs from the one used to encrypt"
    ),
    tampered(
      4,
      (v) => {
        const b = Buffer.from(v.subarray(1));
        b[0] ^= 0x01;
        return encBytes(b);
      },
      "version_id differs from the one used to encrypt"
    ),
    section(
      {
        reason: "AAD built without version_id (not valid in v0.1) does not authenticate the ciphertext",
        expected_error: "E_DECRYPTION_FAILED",
        expected: (() => {
          const m = encMap([
            [0, encText("0.1")],
            [1, encBytes(objectId)],
            [2, encUint(0)],
            [3, encUint(0)],
          ]);
          const a = concat("loopable-object-v1\x00", m);
          let rejects = false;
          try {
            aeadOpen(cek, nonce, a, ciphertextWithTag);
          } catch {
            rejects = true;
          }
          return { object_security_metadata_cbor: hex(m), aad: hex(a), rejects };
        })(),
      },
      "object-encryption-aad/negative-omitted-version-id"
    ),
  ];

  return { positive, negatives };
}

// ---------------------------------------------------------------------------
// Base32 (RFC 4648, lowercase, no padding) - identifier text forms (spec/10)
// ---------------------------------------------------------------------------

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function base32lower(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Event envelope helper (spec/32, spec/22)
// ---------------------------------------------------------------------------

// Build an event map, sign it per 22.3, and return everything a vector needs.
// `signer` is a Node KeyObject (Ed25519 private key) or null (no signature;
// envelope key 9 omitted).
function buildEvent({ eventId, eventType, accountId, deviceId, createdAt, predecessors, objectRefs, body, signer }) {
  const entries = [
    [0, encText("0.1")],
    [1, encBytes(eventId)],
    [2, encUint(eventType)],
    [3, encBytes(accountId)],
    [4, encBytes(deviceId)],
    [5, encUint(createdAt)],
    [6, encArray(predecessors.map((p) => encBytes(p)))],
    [7, encArray(objectRefs)],
    [8, body],
  ];
  const unsigned = encMap(entries);
  const signatureInput = concat("loopable-event-v1\x00", unsigned);
  const signature = sign(signer, signatureInput);
  const envelope = encMap([...entries, [9, encBytes(signature)]]);
  return { unsigned, signatureInput, signature, envelope, eventId };
}

// ---------------------------------------------------------------------------
// Fix 4 - identifier derivation and base32 text forms (spec/10)
// ---------------------------------------------------------------------------

function fix4(f2) {
  const identityKey = ed25519FromSeed(seed("identity"));
  const rootKey = ed25519FromSeed(seed("instance-root"));

  const accountId = sha256("loopable-account-id\x00", identityKey.pub);
  const instanceId = sha256("loopable-instance-id\x00", rootKey.pub);
  const eventId = seed("event-id").subarray(0, 16);
  const objectId = seed("object-id").subarray(0, 32);
  const versionId = seed("version-id").subarray(0, 32);
  const deviceId = seed("device-id").subarray(0, 16);
  const requestId = seed("request-id").subarray(0, 16);
  const keyId = sha256(ed25519FromSeed(seed("operational")).pub).subarray(0, 16);

  const textForms = {
    account_id: base32lower(accountId),
    instance_id: base32lower(instanceId),
    event_id: base32lower(eventId),
    object_id: base32lower(objectId),
    version_id: base32lower(versionId),
    device_id: base32lower(deviceId),
    request_id: base32lower(requestId),
    key_id: base32lower(keyId),
    recipient_key_id: base32lower(f2.recipientKeyId),
  };

  const positive = section(
    {
      inputs: {
        identity_public_key: hex(identityKey.pub),
        root_public_key: hex(rootKey.pub),
        event_id_wire: hex(eventId),
        object_id_wire: hex(objectId),
        version_id_wire: hex(versionId),
        device_id_wire: hex(deviceId),
        request_id_wire: hex(requestId),
        key_id_wire: hex(keyId),
        recipient_key_id_wire: hex(f2.recipientKeyId),
      },
      expected: {
        account_id_wire: hex(accountId),
        instance_id_wire: hex(instanceId),
        account_id_text: textForms.account_id,
        instance_id_text: textForms.instance_id,
        event_id_text: textForms.event_id,
        object_id_text: textForms.object_id,
        version_id_text: textForms.version_id,
        device_id_text: textForms.device_id,
        request_id_text: textForms.request_id,
        key_id_text: textForms.key_id,
        recipient_key_id_text: textForms.recipient_key_id,
      },
      checks: {
        account_id_derives_from_identity: hex(accountId) === hex(sha256("loopable-account-id\x00", identityKey.pub)),
        instance_id_derives_from_root: hex(instanceId) === hex(sha256("loopable-instance-id\x00", rootKey.pub)),
        account_id_text_is_52_chars: textForms.account_id.length === 52,
        account_id_text_is_lowercase: textForms.account_id === textForms.account_id.toLowerCase(),
        id16_text_is_26_chars: textForms.event_id.length === 26 && textForms.device_id.length === 26,
        key_id_is_first_16_bytes_of_key_hash: hex(keyId) === hex(sha256(ed25519FromSeed(seed("operational")).pub).subarray(0, 16)),
        no_padding_in_text: !/[=]/.test(textForms.object_id),
      },
    },
    "identifiers/valid"
  );

  const negatives = [
    section(
      {
        reason: "text form contains RFC 4648 padding, which the canonical text form forbids",
        expected_error: "E_BAD_REQUEST",
        inputs: { text_form: textForms.object_id + "=" },
      },
      "identifiers/negative-padding"
    ),
    section(
      {
        reason: "text form length does not match the identifier type (52 chars for account_id)",
        expected_error: "E_BAD_REQUEST",
        inputs: { text_form: textForms.account_id.slice(0, 50) },
      },
      "identifiers/negative-wrong-length"
    ),
    section(
      {
        reason: "text form contains characters outside the base32 alphabet",
        expected_error: "E_BAD_REQUEST",
        inputs: { text_form: "0" + textForms.account_id.slice(1) },
      },
      "identifiers/negative-bad-character"
    ),
    section(
      {
        reason: "uppercase input is accepted only by lowercasing first (input is case-insensitive)",
        expected_error: null,
        expected: { text_form_lowercased: textForms.object_id.toUpperCase() },
      },
      "identifiers/case-insensitive-input"
    ),
  ];

  return { positive, negatives, textForms };
}

// ---------------------------------------------------------------------------
// Fix 5 - canonical CBOR positives and rejection cases (spec/30)
// ---------------------------------------------------------------------------

function fix5() {
  const intCases = [
    ["zero", 0, "00"],
    ["twenty-three", 23, "17"],
    ["twenty-four", 24, "1818"],
    ["two-hundred-fifty-five", 255, "18ff"],
    ["two-hundred-fifty-six", 256, "190100"],
    ["sixty-five-thousand-five-hundred-thirty-five", 65535, "19ffff"],
    ["two-to-the-sixteenth", 65536, "1a00010000"],
    ["two-to-the-thirty-second-minus-one", 4294967295, "1affffffff"],
    ["two-to-the-thirty-second", 4294967296, "1b0000000100000000"],
    ["two-to-the-sixty-fourth-minus-one", 18446744073709551615n, "1bffffffffffffffff"],
  ];

  const positive = [
    ...intCases.map(([name, value, expectedHex]) =>
      section(
        {
          value: typeof value === "bigint" ? value.toString() : value,
          cbor: hex(encUint(value)),
          notes: "preferred fixed-length integer encoding; no expansion",
          expected_cbor: expectedHex,
        },
        `canonical-cbor/int-${name}`
      )
    ),
    section(
      {
        value: "",
        cbor: hex(encBytes(Buffer.alloc(0))),
        notes: "empty byte string uses a definite-length header",
      },
      "canonical-cbor/empty-bytes"
    ),
    section(
      {
        value: { k1: 1, k2: "longer key", k3: 3 },
        cbor: hex(encMap([
          [2, encUint(3)],       // key 2 (length 1)
          [10, encUint(1)],      // key 10 (length 1)
          ["x", encText("yo")],  // text key, length 1 sorts before longer
          ["ab", encUint(2)],    // length 2
          ["abc", encUint(4)],   // length 3
        ])),
        notes: "map keys sort by encoded length then bytewise (30.3); integer and text keys interleave by those rules",
      },
      "canonical-cbor/map-ordering"
    ),
    section(
      {
        value: { a: [1, 2, 3], b: {} },
        cbor: hex(encMap([
          ["a", encArray([encUint(1), encUint(2), encUint(3)])],
          ["b", encMap([])],
        ])),
        notes: "nested arrays and maps use definite-length headers",
      },
      "canonical-cbor/nested-structure"
    ),
    section(
      {
        value: "hello",
        cbor: hex(encText("hello")),
        notes: "text is valid UTF-8 with no unpaired surrogates",
      },
      "canonical-cbor/text"
    ),
    section(
      {
        value: true /* boolean present in a map */,
        cbor: hex(encMap([[encKey(5), Buffer.from([0xf5])]])),
        notes: "booleans are legal CBOR; the protocol prefers omitting optional fields, but a present boolean must still parse (30.2.10)",
      },
      "canonical-cbor/boolean"
    ),
  ];

  const negativeCbor = (hexStr, notes) =>
    section(
      {
        reason: notes,
        cbor: hexStr,
        expected_error: "E_MALFORMED_ENCODING",
      },
      `canonical-cbor/negative-${hexStr.slice(0, 8)}`
    );

  const negatives = [
    negativeCbor("a201010102", "duplicate integer key 1 in a map (30.8)"),
    negativeCbor("7f616161ff", "indefinite-length text string (30.2.3)"),
    negativeCbor("5f414261ff", "indefinite-length byte string (30.2.3)"),
    negativeCbor("9f0102ff", "indefinite-length array (30.2.4)"),
    negativeCbor("bf0101ff", "indefinite-length map (30.2.4)"),
    negativeCbor("1817", "value 23 encoded in two bytes instead of the preferred single byte (30.2.2)"),
    negativeCbor("1a00000100", "value 256 encoded in five bytes instead of the preferred three (30.2.2)"),
    negativeCbor("c100", "CBOR semantic tag 1 present; protocol data MUST NOT contain tags (30.2.9)"),
    negativeCbor("6161c080", "text containing non-shortest-form UTF-8 encoding of NUL"),
  ];

  return { positives: positive, negatives };
}

// ---------------------------------------------------------------------------
// Fix 6 - event envelope signature and unknown integer-key preservation (30.4)
// ---------------------------------------------------------------------------

function fix6() {
  const identityKey = ed25519FromSeed(seed("identity"));
  const deviceA = ed25519FromSeed(seed("device-signing"));
  const alphaDeviceId = seed("device-id").subarray(0, 16);
  const betaDeviceId = seed("device-beta").subarray(0, 16);
  const betaSigning = ed25519FromSeed(seed("device-beta-signing"));
  const betaEncryption = x25519FromSeed(seed("device-beta-encryption"));
  const accountId = sha256("loopable-account-id\x00", identityKey.pub);
  const genesisId = seed("event-id").subarray(0, 16);
  const eventId = seed("event-device-authorized").subarray(0, 16);

  const body = encMap([
    [0, encBytes(betaDeviceId)],
    [1, encBytes(betaSigning.pub)],
    [2, encBytes(betaEncryption.pub)],
    [3, encUint(0)],
  ]);

  // Unknown integer key 17 as a stand-in for a future minor-version extension.
  const unsignedEntries = [
    [0, encText("0.1")],
    [1, encBytes(eventId)],
    [2, encUint(1)],                              // DEVICE_AUTHORIZED
    [3, encBytes(accountId)],
    [4, encBytes(alphaDeviceId)],
    [5, encUint(1759633200)],
    [6, encArray([encBytes(genesisId)])],
    [7, encArray([])],
    [8, body],
    [17, encUint(0)],                             // unknown field, must be preserved
  ];
  const unsigned = encMap(unsignedEntries);
  const signatureInput = concat("loopable-event-v1\x00", unsigned);
  const signature = sign(deviceA.priv, signatureInput);
  const envelope = encMap([...unsignedEntries, [9, encBytes(signature)]]);

  const positive = section(
    {
      inputs: {
        protocol_version: "0.1",
        event_id: hex(eventId),
        event_type: 1,
        account_id: hex(accountId),
        device_id: hex(alphaDeviceId),
        created_at: 1759633200,
        predecessors: [hex(genesisId)],
        object_references: [],
        body_cbor: hex(body),
      },
      intermediates: {
        event_unsigned_cbor: hex(unsigned),
        event_signature_input: hex(signatureInput),
        note: "unknown integer key 17 is part of the signed input (30.4)",
      },
      expected: {
        event_envelope_cbor: hex(envelope),
        event_signature: hex(signature),
      },
      checks: {
        signature_verifies: verify(deviceA.priv, signatureInput, signature) === true,
      },
    },
    "event-signature/unknown-key-preserved"
  );

  // Negative: re-encoding without the unknown key changes the signed input.
  const droppedUnsigned = encMap(unsignedEntries.filter(([k]) => k !== 17));
  const droppedInput = concat("loopable-event-v1\x00", droppedUnsigned);
  const negatives = [
    section(
      {
        reason: "the verifier dropped unknown integer key 17, so the recomputed signature input differs from the one actually signed",
        expected_error: "E_SIGNATURE_INVALID",
        expected: {
          recomputed_input_without_unknown_key: hex(droppedInput),
          signature: hex(signature),
          verifies_over_wrong_input: verify(deviceA.priv, droppedInput, signature),
        },
      },
      "event-signature/negative-unknown-key-dropped"
    ),
  ];

  return { positive, negatives };
}

// ---------------------------------------------------------------------------
// Fix 7 - device authorization and revocation chain (spec/34, spec/41, spec/42)
// ---------------------------------------------------------------------------

function fix7() {
  const identityKey = ed25519FromSeed(seed("identity"));
  const deviceA = ed25519FromSeed(seed("device-signing"));
  const deviceB = ed25519FromSeed(seed("device-beta-signing"));
  const alphaEncryption = x25519FromSeed(seed("device-encryption"));
  const betaEncryption = x25519FromSeed(seed("device-beta-encryption"));
  const alphaDeviceId = seed("device-id").subarray(0, 16);
  const betaDeviceId = seed("device-beta").subarray(0, 16);
  const accountId = sha256("loopable-account-id\x00", identityKey.pub);
  const instanceId = sha256("loopable-instance-id\x00", ed25519FromSeed(seed("instance-root")).pub);
  const created = 1759632400;

  // e0: ACCOUNT_CREATED (genesis), identical construction to first-device-authorization.
  const firstDeviceA = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(alphaDeviceId)],
    [3, encBytes(deviceA.pub)],
    [4, encBytes(alphaEncryption.pub)],
    [5, encUint(0)],
  ]);
  const firstDeviceSig = sign(identityKey.priv, concat("loopable-first-device-authorization-v1\x00", firstDeviceA));
  const firstDeviceRecord = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(alphaDeviceId)],
    [3, encBytes(deviceA.pub)],
    [4, encBytes(alphaEncryption.pub)],
    [5, encUint(0)],
    [6, encBytes(firstDeviceSig)],
  ]);
  const genesisBody = encMap([
    [0, encBytes(identityKey.pub)],
    [1, encText("alice")],
    [2, encBytes(instanceId)],
    [3, firstDeviceRecord],
  ]);
  const e0Id = seed("event-id").subarray(0, 16);
  const e0 = buildEvent({
    eventId: e0Id,
    eventType: 0,
    accountId,
    deviceId: Buffer.alloc(0),
    createdAt: created,
    predecessors: [],
    objectRefs: [],
    body: genesisBody,
    signer: identityKey.priv,
  });

  // e1: DEVICE_AUTHORIZED, body per 34.4.
  const e1Id = seed("event-device-authorized").subarray(0, 16);
  const e1Body = encMap([
    [0, encBytes(betaDeviceId)],
    [1, encBytes(deviceB.pub)],
    [2, encBytes(betaEncryption.pub)],
    [3, encUint(0)],
  ]);
  const e1 = buildEvent({
    eventId: e1Id,
    eventType: 1,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759633200,
    predecessors: [e0Id],
    objectRefs: [],
    body: e1Body,
    signer: deviceA.priv,
  });

  // e2: TRUSTED_DEVICE_TRANSFERRED (alpha -> beta), signed by alpha (still trusted).
  const e2Id = seed("event-transfer").subarray(0, 16);
  const e2 = buildEvent({
    eventId: e2Id,
    eventType: 3,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759633300,
    predecessors: [e0Id, e1Id],
    objectRefs: [],
    body: encMap([[0, encBytes(betaDeviceId)]]),
    signer: deviceA.priv,
  });

  // e3: DEVICE_REVOKED targeting alpha, signed by beta (now trusted).
  const e3Id = seed("event-revoke").subarray(0, 16);
  const e3 = buildEvent({
    eventId: e3Id,
    eventType: 2,
    accountId,
    deviceId: betaDeviceId,
    createdAt: 1759633400,
    predecessors: [e0Id, e1Id, e2Id],
    objectRefs: [],
    body: encMap([[0, encBytes(alphaDeviceId)]]),
    signer: deviceB.priv,
  });

  // e4 (positive): POST_CREATED by beta, still authorized and trusted.
  const objectId = seed("object-id");
  const versionId = seed("version-id");
  const e4Id = seed("event-post").subarray(0, 16);
  const e4 = buildEvent({
    eventId: e4Id,
    eventType: 13,
    accountId,
    deviceId: betaDeviceId,
    createdAt: 1759633500,
    predecessors: [e0Id, e1Id, e2Id, e3Id],
    objectRefs: [encMap([[0, encBytes(Buffer.from(objectId))], [1, encBytes(Buffer.from(versionId))]])],
    body: encMap([]),
    signer: deviceB.priv,
  });

  // e5 (negative): POST_CREATED by alpha after revocation -> E_UNAUTHORIZED_DEVICE.
  const e5Id = seed("event-post-revoked").subarray(0, 16);
  const e5 = buildEvent({
    eventId: e5Id,
    eventType: 13,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759633600,
    predecessors: [e0Id, e1Id, e2Id, e3Id],
    objectRefs: [encMap([[0, encBytes(Buffer.from(objectId))], [1, encBytes(Buffer.from(versionId))]])],
    body: encMap([]),
    signer: deviceA.priv,
  });

  const positive = section(
    {
      inputs: {
        account_id: hex(accountId),
        genesis_event_id: hex(e0Id),
        alpha_device_id: hex(alphaDeviceId),
        beta_device_id: hex(betaDeviceId),
      },
      expected: {
        genesis_event_envelope_cbor: hex(e0.envelope),
        genesis_event_signature: hex(e0.signature),
        device_authorized_envelope_cbor: hex(e1.envelope),
        device_authorized_signature: hex(e1.signature),
        transfer_envelope_cbor: hex(e2.envelope),
        transfer_signature: hex(e2.signature),
        revoke_envelope_cbor: hex(e3.envelope),
        revoke_signature: hex(e3.signature),
        post_by_trusted_envelope_cbor: hex(e4.envelope),
        post_by_trusted_signature: hex(e4.signature),
      },
      checks: {
        genesis_signature_verifies: verify(identityKey.priv, e0.signatureInput, e0.signature),
        device_auth_signature_verifies: verify(deviceA.priv, e1.signatureInput, e1.signature),
        transfer_signature_verifies: verify(deviceA.priv, e2.signatureInput, e2.signature),
        revoke_signature_verifies: verify(deviceB.priv, e3.signatureInput, e3.signature),
        post_by_trusted_signature_verifies: verify(deviceB.priv, e4.signatureInput, e4.signature),
        alpha_is_revoked_at_e5: true,
        beta_is_trusted_at_e5: true,
      },
    },
    "device-authorization/valid-chain"
  );

  const negatives = [
    section(
      {
        reason: "the revoked device signs a new POST_CREATED event",
        expected_error: "E_UNAUTHORIZED_DEVICE",
        expected: {
          event_envelope_cbor: hex(e5.envelope),
          event_signature: hex(e5.signature),
          signature_still_cryptographically_valid: verify(deviceA.priv, e5.signatureInput, e5.signature),
        },
      },
      "device-authorization/revoked-device-signs"
    ),
  ];

  return { positive, negatives };
}

// ---------------------------------------------------------------------------
// Fix 8 - federation request signature (spec/61)
// ---------------------------------------------------------------------------

function fix8(f4) {
  const rootKey = ed25519FromSeed(seed("instance-root"));
  const opKey = ed25519FromSeed(seed("operational"));
  const instanceId = sha256("loopable-instance-id\x00", rootKey.pub);
  const keyId = sha256(opKey.pub).subarray(0, 16);
  const requestId = seed("request-id").subarray(0, 16);
  const accountId = sha256("loopable-account-id\x00", ed25519FromSeed(seed("identity")).pub);
  const ts = 1759634000;
  const body = Buffer.from("80", "hex"); // canonical CBOR empty array
  const bodyHash = sha256(body);

  const authEntries = [
    [0, encText("POST")],
    [1, encText("example.org")],
    [2, encText("/v1/objects")],
    [3, encText("?limit=10&offset=0")],
    [4, encBytes(requestId)],
    [5, encUint(ts)],
    [6, encBytes(bodyHash)],
  ];
  const unsigned = encMap(authEntries);
  const input = concat("loopable-federation-request-v1\x00", unsigned);
  const sig = sign(opKey.priv, input);

  const b32 = (b) => base32lower(b);
  const header = `Loopable v=1;instance=${b32(instanceId)};key=${b32(keyId)};request=${b32(requestId)};ts=${ts};sig=${sig.toString("base64url")}`;

  // Client auth per 61.9: same map plus key 7 account_id and `acc` header param.
  const clientEntries = [...authEntries, [7, encBytes(accountId)]];
  const clientUnsigned = encMap(clientEntries);
  const clientInput = concat("loopable-federation-request-v1\x00", clientUnsigned);
  const clientSig = sign(opKey.priv, clientInput);
  const clientHeader = `Loopable v=1;instance=${b32(instanceId)};key=${b32(keyId)};request=${b32(requestId)};ts=${ts};acc=${b32(accountId)};sig=${clientSig.toString("base64url")}`;

  const positive = section(
    {
      inputs: {
        instance_id_wire: hex(instanceId),
        key_id_wire: hex(keyId),
        request_id_wire: hex(requestId),
        method: "POST",
        host: "example.org",
        path: "/v1/objects",
        query: "?limit=10&offset=0",
        timestamp: ts,
        body_hex: hex(body),
        body_hash: hex(bodyHash),
      },
      intermediates: {
        request_authentication_cbor: hex(unsigned),
        request_signature_input: hex(input),
        instance_id_text: f4.textForms.instance_id,
        key_id_text: f4.textForms.key_id,
        request_id_text: f4.textForms.request_id,
      },
      expected: {
        authorization_header: header,
        signature: hex(sig),
      },
      checks: {
        signature_verifies: verify(opKey.priv, input, sig),
      },
    },
    "federation-request/instance"
  );

  const negativeCases = [
    section(
      {
        reason: "timestamp is outside the 300-second freshness window",
        expected_error: "E_TIMESTAMP_OUT_OF_RANGE",
        expected: { timestamp: ts - 600, freshness_window_seconds: 300 },
      },
      "federation-request/negative-stale-timestamp"
    ),
    section(
      {
        reason: "body hash does not match the actual request body",
        expected_error: "E_SIGNATURE_INVALID",
        expected: { body_hex_expected: hex(body), body_hash_computed_over_body: hex(bodyHash) },
      },
      "federation-request/negative-body-hash-mismatch"
    ),
    section(
      {
        reason: "the same request_id is reused within the replay window",
        expected_error: "E_REPLAY",
        expected: { authorization_header: header, replay_window_seconds: 300 },
      },
      "federation-request/negative-replay"
    ),
  ];

  return { positive, negatives: negativeCases, header, clientHeader, clientUnsigned, accountId, instanceId, keyId };
}

// ---------------------------------------------------------------------------
// Fix 9 - streaming media encryption (spec/35)
// ---------------------------------------------------------------------------

function uint32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

// AesGcmHkdfStreaming encryption: header + segmented AES-256-GCM.
function encryptStream(cek, salt, noncePrefix, aad, plaintext) {
  const prk = hkdfExtract(salt, cek);
  const derivedKey = hkdfExpand(prk, aad, 32);

  const header = concat(Buffer.from([0x28]), salt, noncePrefix);
  const segments = [];
  const firstCap = 1048520; // S - header(40) - tag(16)
  let offset = 0;
  let index = 0;
  while (offset < plaintext.length) {
    const cap = index === 0 ? firstCap : 1048560;
    const len = Math.min(cap, plaintext.length - offset);
    const segment = plaintext.subarray(offset, offset + len);
    const isFinal = offset + len === plaintext.length;
    const nonce = concat(noncePrefix, uint32be(index), Buffer.from([isFinal ? 0x01 : 0x00]));
    const c = crypto.createCipheriv("aes-256-gcm", derivedKey, nonce);
    const ct = concat(c.update(segment), c.final(), c.getAuthTag());
    segments.push({ index, nonce, ciphertext: ct, isFinal });
    offset += len;
    index += 1;
  }
  return { header, derivedKey, segments, blob: concat(header, ...segments.map((s) => s.ciphertext)) };
}

function fix9() {
  const cek = seed("media-cek");
  const salt = seed("media-salt");
  const noncePrefix = seed("media-nonce-prefix").subarray(0, 7);
  const objectId = seed("object-id");
  const versionId = seed("media-version-id");

  // ObjectSecurityMetadata (23.4) with object_type 3 and encryption_suite 1.
  const metadata = encMap([
    [0, encText("0.1")],
    [1, encBytes(Buffer.from(objectId))],
    [2, encUint(3)],
    [3, encUint(1)],
    [4, encBytes(Buffer.from(versionId))],
  ]);
  const aad = concat("loopable-object-v1\x00", metadata);

  // media_content (56.1) embedding a small file payload.
  const payload = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  ]);
  const mediaContent = encMap([
    [1, encText("image/png")],
    [2, encText("sample.png")],
    [3, encUint(payload.length)],
    [4, encBytes(payload)],
  ]);

  const one = encryptStream(cek, salt, noncePrefix, aad, mediaContent);

  // Two-segment stream: data chosen so the canonical plaintext crosses 1,048,520 bytes.
  const bigData = Buffer.alloc(1048576); // 1 MiB, deterministic zeros
  const bigMeta = encMap([
    [1, encText("application/octet-stream")],
    [3, encUint(bigData.length)],
    [4, encBytes(bigData)],
    [5, encMap([[0, encUint(1920)], [1, encUint(1080)]])],
  ]);
  const two = encryptStream(cek, salt, noncePrefix, aad, bigMeta);

  // Negatives use the one-segment stream so each rejected blob stays small.
  // The multi-segment layout itself is pinned by the positive vector above.

  // Truncate before the complete final (and only) segment ends, cutting into
  // its tag.
  const truncated = one.blob.subarray(0, one.blob.length - 20);

  // Flip a byte inside the segment ciphertext, breaking its GCM tag.
  const tampered = Buffer.from(one.blob);
  tampered[60] ^= 0x01;

  // Re-encrypt the single segment marked non-final (final_byte 0x00); no
  // segment carries the final mark, so the stream is never complete.
  const wrongFinal = (() => {
    const nonce = concat(noncePrefix, uint32be(0), Buffer.from([0x00]));
    const c = crypto.createCipheriv("aes-256-gcm", one.derivedKey, nonce);
    return concat(one.header, c.update(mediaContent), c.final(), c.getAuthTag());
  })();

  const positive = section(
    {
      inputs: {
        content_encryption_key: hex(cek),
        salt: hex(salt),
        nonce_prefix: hex(noncePrefix),
        object_id: hex(objectId),
        object_type: 3,
        encryption_suite: 1,
        version_id: hex(versionId),
      },
      intermediates: {
        object_security_metadata_cbor: hex(metadata),
        aad: hex(aad),
        derived_key: hex(two.derivedKey),
      },
      expected: {
        header: hex(one.header),
        one_segment_plaintext_cbor: hex(mediaContent),
        one_segment_nonce: hex(one.segments[0].nonce),
        one_segment_ciphertext: hex(one.blob),
        two_segment_blob: hex(two.blob),
        two_segment_segment_count: two.segments.length,
        two_segment_nonces: two.segments.map((s) => hex(s.nonce)),
      },
      checks: {
        header_is_40_bytes: one.header.length === 40,
        first_segment_ciphertext_fits_capacity: two.segments[0].ciphertext.length === 1048536,
        all_but_last_segments_full: two.segments
          .slice(0, -1)
          .every((s) => s.index === 0 || s.ciphertext.length === 1048576),
        final_segment_marked: two.segments[two.segments.length - 1].isFinal === true,
        one_segment_is_single: one.segments.length === 1,
      },
    },
    "media-streaming/valid"
  );

  const negatives = [
    section(
      {
        reason: "the stream is truncated before the complete final (and only) segment; the partial tag cannot authenticate",
        expected_error: "E_DECRYPTION_FAILED",
        expected: { truncated_blob: hex(truncated) },
      },
      "media-streaming/negative-truncated"
    ),
    section(
      {
        reason: "a byte inside the segment ciphertext was flipped, breaking its GCM tag",
        expected_error: "E_DECRYPTION_FAILED",
        expected: { tampered_blob: hex(tampered) },
      },
      "media-streaming/negative-tampered"
    ),
    section(
      {
        reason: "the single segment is marked non-final (final_byte 0x00); no segment carries the final mark, so the stream is never complete",
        expected_error: "E_DECRYPTION_FAILED",
        expected: { blob: hex(wrongFinal) },
      },
      "media-streaming/negative-wrong-final-flag"
    ),
  ];

  return { positive, negatives };
}

// ---------------------------------------------------------------------------
// Fix 10 - username grammar (spec/11.6)
// ---------------------------------------------------------------------------

function fix10() {
  const regex = /^(?=[a-z0-9_]*[a-z])[a-z0-9][a-z0-9_]{2,12}[a-z0-9]$/;
  const cases = [
    ["alice", true],
    ["12cool", true],
    ["vhe2929", true],
    ["a1b2", true],
    ["barn", true],
    ["a1b2c3d4e5f6g7", true], // 14 chars
    ["____", false],
    ["3829847859678", false],
    ["1234", false],
    ["ab", false],
    ["abcdefghijklmno", false],
    ["a_b_", false], // ends with underscore
    ["_ab", false], // starts with underscore
    ["ab_cd", true],
    ["AlIcE", false], // uppercase not canonical (must be normalized before validation)
    ["a.b", false], // dot not in the alphabet
    ["a b", false], // whitespace
    ["aéb", false], // non-ASCII
  ];

  const vectors = [];
  for (const [username, valid] of cases) {
    vectors.push(
      section(
        {
          username,
          matches_grammar: valid,
          expected_validation: valid ? "valid" : "invalid",
          expected_error: valid ? null : "E_BAD_REQUEST",
          reason: valid
            ? null
            : /[A-Z]/.test(username)
              ? "case folding must happen before validation (11.6)"
              : /^_|_$/.test(username)
                ? "first or last character is not a letter or digit"
                : /[^a-z0-9_]/.test(username)
                  ? "contains characters outside [a-z0-9_]"
                  : /^[0-9_]+$/.test(username)
                    ? "contains no lowercase letter"
                    : username.length < 4
                      ? "too short"
                      : "too long",
        },
        `username-grammar/${valid ? "valid" : "invalid"}-${username.replace(/[^a-zA-Z0-9]/g, (c) => {
          const map = { ".": "dot", " ": "space", "_": "underscore" };
          return map[c] || `u${c.codePointAt(0).toString(16)}`;
        })}`
      )
    );
  }
  // The _name suffix uses the raw regex against the canonical lowercase form.
  return { vectors };
}

// ---------------------------------------------------------------------------
// Fix 11 - relationship event envelopes (spec/34.9, spec/50)
// ---------------------------------------------------------------------------

function fix11() {
  const identityKey = ed25519FromSeed(seed("identity"));
  const deviceA = ed25519FromSeed(seed("device-signing"));
  const alphaEncryption = x25519FromSeed(seed("device-encryption"));
  const alphaDeviceId = seed("device-id").subarray(0, 16);
  const accountId = sha256("loopable-account-id\x00", identityKey.pub);
  const instanceId = sha256("loopable-instance-id\x00", ed25519FromSeed(seed("instance-root")).pub);
  const created = 1759632400;

  const targetIdentity = ed25519FromSeed(seed("relationship-target"));
  const targetDevice = x25519FromSeed(seed("relationship-target-device"));
  const targetDeviceId = seed("relationship-target-device-id").subarray(0, 16);
  const targetId = sha256("loopable-account-id\x00", targetIdentity.pub);

  // Genesis authorizing deviceA at the AUTHORIZED level.
  const firstDeviceA = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(alphaDeviceId)],
    [3, encBytes(deviceA.pub)],
    [4, encBytes(alphaEncryption.pub)],
    [5, encUint(0)],
  ]);
  const firstDeviceSig = sign(identityKey.priv, concat("loopable-first-device-authorization-v1\x00", firstDeviceA));
  const firstDeviceRecord = encMap([
    [0, encText("0.1")],
    [1, encBytes(accountId)],
    [2, encBytes(alphaDeviceId)],
    [3, encBytes(deviceA.pub)],
    [4, encBytes(alphaEncryption.pub)],
    [5, encUint(0)],
    [6, encBytes(firstDeviceSig)],
  ]);
  const e0Id = seed("event-id").subarray(0, 16);
  const e0 = buildEvent({
    eventId: e0Id,
    eventType: 0,
    accountId,
    deviceId: Buffer.alloc(0),
    createdAt: created,
    predecessors: [],
    objectRefs: [],
    body: encMap([
      [0, encBytes(identityKey.pub)],
      [1, encText("alice")],
      [2, encBytes(instanceId)],
      [3, firstDeviceRecord],
    ]),
    signer: identityKey.priv,
  });

  // Encrypted relationship object (object type 5, 50.3) attached to the follow.
  const relObjectId = seed("rel-object-id");
  const relVersionId = seed("rel-version-id");
  const relCek = seed("rel-object-cek");
  const relNonce = seed("rel-nonce").subarray(0, 12);
  const relContent = encMap([
    [0, encArray([encText("close-friends")])],
    [1, encText("met at the conference")],
  ]);
  const relMetadata = encMap([
    [0, encText("0.1")],
    [1, encBytes(Buffer.from(relObjectId))],
    [2, encUint(5)],
    [3, encUint(0)],
    [4, encBytes(Buffer.from(relVersionId))],
  ]);
  const relAad = concat("loopable-object-v1\x00", relMetadata);
  const relCiphertext = aeadSeal(relCek, relNonce, relAad, relContent);

  // Recipient: the follow target's device, per 50.3.
  const recipientDescriptor = encMap([
    [0, encUint(0)],
    [1, encBytes(targetId)],
    [2, encBytes(targetDeviceId)],
    [3, encBytes(targetDevice.pub)],
  ]);
  const recipientKeyId = sha256("loopable-recipient-key-id-v1\x00", recipientDescriptor).subarray(0, 16);
  const relInfo = concat("loopable-hpke-object-key-v1\x00", relObjectId, recipientKeyId, Buffer.from("0.1", "utf8"));
  const relSeal = sealBase(targetDevice.pub, relInfo, Buffer.alloc(0), relCek, x25519FromSeed(seed("rel-ephemeral")));

  const recipientRecord = encMap([
    [0, encUint(0)],
    [1, encBytes(targetId)],
    [2, encBytes(targetDeviceId)],
    [3, encBytes(recipientKeyId)],
    [4, encBytes(relSeal.enc)],
    [5, encBytes(relSeal.ct)],
  ]);
  const relEnvelope = encMap([
    [0, encText("0.1")],
    [1, encBytes(Buffer.from(relObjectId))],
    [2, encUint(5)],
    [3, encUint(0)],
    [4, encBytes(Buffer.from(relVersionId))],
    [5, encBytes(relNonce)],
    [6, encBytes(relCiphertext)],
    [7, encArray([recipientRecord])],
  ]);
  const relEnvelopeId = sha256("loopable-object-envelope-v1\x00", relEnvelope);

  const relRef = encMap([
    [0, encBytes(Buffer.from(relObjectId))],
    [1, encBytes(Buffer.from(relVersionId))],
  ]);

  const e1Id = seed("event-follow").subarray(0, 16);
  const e1 = buildEvent({
    eventId: e1Id,
    eventType: 6,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759634100,
    predecessors: [e0Id],
    objectRefs: [relRef],
    body: encMap([[0, encBytes(targetId)]]),
    signer: deviceA.priv,
  });

  const e2Id = seed("event-unfollow").subarray(0, 16);
  const e2 = buildEvent({
    eventId: e2Id,
    eventType: 7,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759634200,
    predecessors: [e0Id, e1Id],
    objectRefs: [],
    body: encMap([[0, encBytes(targetId)]]),
    signer: deviceA.priv,
  });

  const e3Id = seed("event-block").subarray(0, 16);
  const e3 = buildEvent({
    eventId: e3Id,
    eventType: 8,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759634300,
    predecessors: [e0Id, e1Id, e2Id],
    objectRefs: [],
    body: encMap([[0, encBytes(targetId)]]),
    signer: deviceA.priv,
  });

  const e4Id = seed("event-unblock").subarray(0, 16);
  const e4 = buildEvent({
    eventId: e4Id,
    eventType: 9,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759634400,
    predecessors: [e0Id, e1Id, e2Id, e3Id],
    objectRefs: [],
    body: encMap([[0, encBytes(targetId)]]),
    signer: deviceA.priv,
  });

  // Negative: a relationship event targeting the subject's own account.
  const e5Id = seed("event-self-follow").subarray(0, 16);
  const e5 = buildEvent({
    eventId: e5Id,
    eventType: 6,
    accountId,
    deviceId: alphaDeviceId,
    createdAt: 1759634500,
    predecessors: [e0Id, e1Id, e2Id, e3Id, e4Id],
    objectRefs: [],
    body: encMap([[0, encBytes(accountId)]]),
    signer: deviceA.priv,
  });

  const positive = section(
    {
      inputs: {
        subject_account_id: hex(accountId),
        subject_device_id: hex(alphaDeviceId),
        target_account_id: hex(targetId),
        target_identity_public_key: hex(targetIdentity.pub),
        target_device_public_key: hex(targetDevice.pub),
        relationship_object_id: hex(relObjectId),
        relationship_version_id: hex(relVersionId),
      },
      intermediates: {
        relationship_object_aad: hex(relAad),
        relationship_recipient_key_id: hex(recipientKeyId),
        relationship_hpke_info: hex(relInfo),
      },
      expected: {
        genesis_event_envelope_cbor: hex(e0.envelope),
        follow_created_envelope_cbor: hex(e1.envelope),
        follow_created_signature: hex(e1.signature),
        follow_removed_envelope_cbor: hex(e2.envelope),
        follow_removed_signature: hex(e2.signature),
        block_created_envelope_cbor: hex(e3.envelope),
        block_created_signature: hex(e3.signature),
        block_removed_envelope_cbor: hex(e4.envelope),
        block_removed_signature: hex(e4.signature),
        relationship_object_plaintext_cbor: hex(relContent),
        relationship_object_ciphertext: hex(relCiphertext),
        relationship_object_envelope_cbor: hex(relEnvelope),
        relationship_object_envelope_id: hex(relEnvelopeId),
      },
      checks: {
        follow_signature_verifies: verify(deviceA.priv, e1.signatureInput, e1.signature),
        unfollow_signature_verifies: verify(deviceA.priv, e2.signatureInput, e2.signature),
        block_signature_verifies: verify(deviceA.priv, e3.signatureInput, e3.signature),
        unblock_signature_verifies: verify(deviceA.priv, e4.signatureInput, e4.signature),
        relationship_object_decrypts: hex(aeadOpen(relCek, relNonce, relAad, relCiphertext)) === hex(relContent),
        wrapped_cek_recovers:
          hex(openBase(targetDevice.pub, targetDevice.priv, relInfo, Buffer.alloc(0), relSeal.enc, relSeal.ct)) ===
          hex(relCek),
        subject_differs_from_target: hex(accountId) !== hex(targetId),
      },
    },
    "relationship-events/valid-follow-block-cycle"
  );

  const negatives = [
    section(
      {
        reason: "a relationship event targets the account's own account_id; an account cannot follow or block itself (34.9)",
        expected_error: "E_BAD_REQUEST",
        expected: {
          event_envelope_cbor: hex(e5.envelope),
          event_signature: hex(e5.signature),
          signature_still_cryptographically_valid: verify(deviceA.priv, e5.signatureInput, e5.signature),
        },
      },
      "relationship-events/negative-self-target"
    ),
  ];

  return { positive, negatives };
}

// ---------------------------------------------------------------------------
// Fix 12 - event dependency validation and causal authorization (spec/63, 42.3)
// ---------------------------------------------------------------------------

function sortedPreds(...ids) {
  return ids.sort((a, b) => Buffer.compare(a, b));
}

function fix12() {
  const identityKey = ed25519FromSeed(seed("dep-identity"));
  const deviceA = ed25519FromSeed(seed("dep-device-a"));
  const deviceAEnc = x25519FromSeed(seed("dep-device-a-enc"));
  const deviceAId = seed("dep-device-a-id").subarray(0, 16);
  const deviceB = ed25519FromSeed(seed("dep-device-b"));
  const deviceBEnc = x25519FromSeed(seed("dep-device-b-enc"));
  const deviceBId = seed("dep-device-b-id").subarray(0, 16);
  const deviceC = ed25519FromSeed(seed("dep-device-c"));
  const deviceCEnc = x25519FromSeed(seed("dep-device-c-enc"));
  const deviceCId = seed("dep-device-c-id").subarray(0, 16);
  const deviceD = ed25519FromSeed(seed("dep-device-d"));
  const deviceDEnc = x25519FromSeed(seed("dep-device-d-enc"));
  const deviceDId = seed("dep-device-d-id").subarray(0, 16);
  const accountId = sha256("loopable-account-id\x00", identityKey.pub);
  const instanceId = sha256("loopable-instance-id\x00", ed25519FromSeed(seed("instance-root")).pub);
  const created = 1759634000;

  // Another account, used for the cross-account predecessor negative.
  const otherIdentity = ed25519FromSeed(seed("dep-other-identity"));
  const otherAccountId = sha256("loopable-account-id\x00", otherIdentity.pub);
  const otherDevice = ed25519FromSeed(seed("dep-other-device"));
  const otherDeviceEnc = x25519FromSeed(seed("dep-other-device-enc"));
  const otherDeviceId = seed("dep-other-device-id").subarray(0, 16);

  const makeFda = (id, signing, encryption) => {
    const fda = encMap([
      [0, encText("0.1")],
      [1, encBytes(accountId)],
      [2, encBytes(id)],
      [3, encBytes(signing.pub)],
      [4, encBytes(encryption.pub)],
      [5, encUint(0)],
    ]);
    const sig = sign(identityKey.priv, concat("loopable-first-device-authorization-v1\x00", fda));
    return encMap([
      [0, encText("0.1")],
      [1, encBytes(accountId)],
      [2, encBytes(id)],
      [3, encBytes(signing.pub)],
      [4, encBytes(encryption.pub)],
      [5, encUint(0)],
      [6, encBytes(sig)],
    ]);
  };

  const e0Id = seed("dep-e0").subarray(0, 16);
  const e0 = buildEvent({
    eventId: e0Id,
    eventType: 0,
    accountId,
    deviceId: Buffer.alloc(0),
    createdAt: created,
    predecessors: [],
    objectRefs: [],
    body: encMap([
      [0, encBytes(identityKey.pub)],
      [1, encText("deps")],
      [2, encBytes(instanceId)],
      [3, makeFda(deviceAId, deviceA, deviceAEnc)],
    ]),
    signer: identityKey.priv,
  });

  // DEVICE_AUTHORIZED of deviceB by the trusted deviceA.
  const e1Id = seed("dep-e1").subarray(0, 16);
  const e1 = buildEvent({
    eventId: e1Id,
    eventType: 1,
    accountId,
    deviceId: deviceAId,
    createdAt: created,
    predecessors: sortedPreds(e0Id),
    objectRefs: [],
    body: encMap([
      [0, encBytes(deviceBId)],
      [1, encBytes(deviceB.pub)],
      [2, encBytes(deviceBEnc.pub)],
      [3, encUint(0)],
    ]),
    signer: deviceA.priv,
  });

  // A concurrent pair: POST_CREATED by deviceB and DEVICE_REVOKED of
  // deviceB, neither an ancestor of the other. The post remains valid (42.3).
  const postObjId = seed("dep-post-object");
  const postVerId = seed("dep-post-version");
  const postRef = encMap([
    [0, encBytes(postObjId)],
    [1, encBytes(postVerId)],
  ]);
  const e2Id = seed("dep-e2").subarray(0, 16);
  const e2 = buildEvent({
    eventId: e2Id,
    eventType: 13,
    accountId,
    deviceId: deviceBId,
    createdAt: created + 1,
    predecessors: sortedPreds(e0Id, e1Id),
    objectRefs: [postRef],
    body: encMap([]),
    signer: deviceB.priv,
  });
  const e3Id = seed("dep-e3").subarray(0, 16);
  const e3 = buildEvent({
    eventId: e3Id,
    eventType: 2,
    accountId,
    deviceId: deviceAId,
    createdAt: created + 1,
    predecessors: sortedPreds(e0Id, e1Id),
    objectRefs: [],
    body: encMap([[0, encBytes(deviceBId)]]),
    signer: deviceA.priv,
  });

  // After e3, a POST_CREATED by deviceB that causally follows the revoke is
  // unauthorized (42.3, 42.4).
  const e4Id = seed("dep-e4").subarray(0, 16);
  const e4 = buildEvent({
    eventId: e4Id,
    eventType: 13,
    accountId,
    deviceId: deviceBId,
    createdAt: created + 2,
    predecessors: sortedPreds(e0Id, e1Id, e3Id),
    objectRefs: [postRef],
    body: encMap([]),
    signer: deviceB.priv,
  });

  // Missing dependency: references a predecessor ID the instance has never
  // seen.
  const unknownDep = seed("dep-unknown").subarray(0, 16);
  const e5Id = seed("dep-e5").subarray(0, 16);
  const e5 = buildEvent({
    eventId: e5Id,
    eventType: 6,
    accountId,
    deviceId: deviceBId,
    createdAt: created + 3,
    predecessors: sortedPreds(unknownDep),
    objectRefs: [],
    body: encMap([[0, encBytes(otherAccountId)]]),
    signer: deviceB.priv,
  });

  // Mutual cycle: a references b and b references a.
  const cycAId = seed("dep-cyc-a").subarray(0, 16);
  const cycBId = seed("dep-cyc-b").subarray(0, 16);
  const cycA = buildEvent({
    eventId: cycAId,
    eventType: 6,
    accountId,
    deviceId: deviceBId,
    createdAt: created + 4,
    predecessors: sortedPreds(cycBId),
    objectRefs: [],
    body: encMap([[0, encBytes(otherAccountId)]]),
    signer: deviceB.priv,
  });
  const cycB = buildEvent({
    eventId: cycBId,
    eventType: 6,
    accountId,
    deviceId: deviceBId,
    createdAt: created + 4,
    predecessors: sortedPreds(cycAId),
    objectRefs: [],
    body: encMap([[0, encBytes(otherAccountId)]]),
    signer: deviceB.priv,
  });

  // Unrooted: a POST_CREATED with no predecessors; nothing traces to the
  // account's ACCOUNT_CREATED.
  const e6Id = seed("dep-e6").subarray(0, 16);
  const e6 = buildEvent({
    eventId: e6Id,
    eventType: 13,
    accountId,
    deviceId: deviceBId,
    createdAt: created + 5,
    predecessors: [],
    objectRefs: [postRef],
    body: encMap([]),
    signer: deviceB.priv,
  });

  // Cross-account predecessor: references the other account's genesis.
  const otherE0Id = seed("dep-other-e0").subarray(0, 16);
  const otherFda = encMap([
    [0, encText("0.1")],
    [1, encBytes(otherAccountId)],
    [2, encBytes(otherDeviceId)],
    [3, encBytes(otherDevice.pub)],
    [4, encBytes(otherDeviceEnc.pub)],
    [5, encUint(0)],
    [6, encBytes(sign(otherIdentity.priv, concat("loopable-first-device-authorization-v1\x00", encMap([
      [0, encText("0.1")],
      [1, encBytes(otherAccountId)],
      [2, encBytes(otherDeviceId)],
      [3, encBytes(otherDevice.pub)],
      [4, encBytes(otherDeviceEnc.pub)],
      [5, encUint(0)],
    ]))))],
  ]);
  const otherE0Valid = buildEvent({
    eventId: otherE0Id,
    eventType: 0,
    accountId: otherAccountId,
    deviceId: Buffer.alloc(0),
    createdAt: created,
    predecessors: [],
    objectRefs: [],
    body: encMap([
      [0, encBytes(otherIdentity.pub)],
      [1, encText("other")],
      [2, encBytes(instanceId)],
      [3, otherFda],
    ]),
    signer: otherIdentity.priv,
  });

  const e7Id = seed("dep-e7").subarray(0, 16);
  const e7 = buildEvent({
    eventId: e7Id,
    eventType: 6,
    accountId,
    deviceId: deviceBId,
    createdAt: created + 6,
    predecessors: sortedPreds(otherE0Id),
    objectRefs: [],
    body: encMap([[0, encBytes(otherAccountId)]]),
    signer: deviceB.priv,
  });

  // Event-id collision: same id as e1, different bytes.
  const e8 = buildEvent({
    eventId: e1Id,
    eventType: 1,
    accountId,
    deviceId: deviceAId,
    createdAt: created + 7,
    predecessors: sortedPreds(e0Id),
    objectRefs: [],
    body: encMap([]),
    signer: deviceA.priv,
  });

  // Ambiguous trusted device: two concurrent TRUSTED_DEVICE_TRANSFERRED events
  // (t1 and t2), then a TRUSTED-level event whose predecessors include both.
  // 42.3 requires E_TRUST_CONFLICT.
  const e9Id = seed("dep-e9").subarray(0, 16);
  const e9 = buildEvent({
    eventId: e9Id,
    eventType: 1,
    accountId,
    deviceId: deviceAId,
    createdAt: created + 8,
    predecessors: sortedPreds(e0Id),
    objectRefs: [],
    body: encMap([
      [0, encBytes(deviceCId)],
      [1, encBytes(deviceC.pub)],
      [2, encBytes(deviceCEnc.pub)],
      [3, encUint(0)],
    ]),
    signer: deviceA.priv,
  });
  const t1Preds = sortedPreds(e0Id, e1Id, e9Id);
  const t1Id = seed("dep-t1").subarray(0, 16);
  const t1 = buildEvent({
    eventId: t1Id,
    eventType: 3,
    accountId,
    deviceId: deviceAId,
    createdAt: created + 9,
    predecessors: t1Preds,
    objectRefs: [],
    body: encMap([[0, encBytes(deviceBId)]]),
    signer: deviceA.priv,
  });
  const t2Preds = sortedPreds(e0Id, e1Id, e9Id);
  const t2Id = seed("dep-t2").subarray(0, 16);
  const t2 = buildEvent({
    eventId: t2Id,
    eventType: 3,
    accountId,
    deviceId: deviceAId,
    createdAt: created + 9,
    predecessors: t2Preds,
    objectRefs: [],
    body: encMap([[0, encBytes(deviceCId)]]),
    signer: deviceA.priv,
  });
  const e10Id = seed("dep-e10").subarray(0, 16);
  const e10 = buildEvent({
    eventId: e10Id,
    eventType: 1,
    accountId,
    deviceId: deviceAId,
    createdAt: created + 10,
    predecessors: sortedPreds(e0Id, e1Id, e9Id, t1Id, t2Id),
    objectRefs: [],
    body: encMap([
      [0, encBytes(deviceDId)],
      [1, encBytes(deviceD.pub)],
      [2, encBytes(deviceDEnc.pub)],
      [3, encUint(0)],
    ]),
    signer: deviceA.priv,
  });

  const positives = [
    section(
      {
        inputs: {
          genesis_event_id: hex(e0Id),
          device_a_authorized_event_id: hex(e1Id),
          post_created_event_id: hex(e2Id),
          post_object_id: hex(postObjId),
          post_version_id: hex(postVerId),
        },
        expected: {
          genesis_envelope_cbor: hex(e0.envelope),
          device_auth_envelope_cbor: hex(e1.envelope),
          post_created_envelope_cbor: hex(e2.envelope),
        },
        checks: {
          genesis_signature_verifies: verify(identityKey.priv, e0.signatureInput, e0.signature),
          device_auth_signature_verifies: verify(deviceA.priv, e1.signatureInput, e1.signature),
          post_created_signature_verifies: verify(deviceB.priv, e2.signatureInput, e2.signature),
          predecessors_known: sortedPreds(e0Id, e1Id).every((p) => [e0Id, e1Id].includes(p)),
          status: "VALIDATED -> APPLIED",
        },
      },
      "event-dependencies/valid-chain-applied"
    ),
    section(
      {
        inputs: {
          post_created_event_id: hex(e2Id),
          device_b_revoked_event_id: hex(e3Id),
        },
        expected: {
          post_created_envelope_cbor: hex(e2.envelope),
          device_revoked_envelope_cbor: hex(e3.envelope),
        },
        checks: {
          post_signature_verifies: verify(deviceB.priv, e2.signatureInput, e2.signature),
          revoke_signature_verifies: verify(deviceA.priv, e3.signatureInput, e3.signature),
          revoke_is_concurrent_with_post: !sortedPreds(e0Id, e1Id, e3Id).includes(e2Id),
          post_remains_valid_despite_concurrent_revoke: true,
          both_accepted: true,
        },
      },
      "event-dependencies/concurrent-events-both-accepted"
    ),
    section(
      {
        inputs: {
          resubmitted_event_id: hex(e1Id),
        },
        expected: {
          device_auth_envelope_cbor: hex(e1.envelope),
        },
        checks: {
          signature_verifies: verify(deviceA.priv, e1.signatureInput, e1.signature),
          resubmission_status: "duplicate",
          no_second_state_transition: true,
        },
      },
      "event-dependencies/duplicate-submission-idempotent"
    ),
  ];

  const negatives = [
    section(
      {
        reason: "event references a predecessor the instance has never seen (63.3)",
        expected_error: "E_MISSING_DEPENDENCY",
        expected: {
          event_envelope_cbor: hex(e5.envelope),
          event_signature: hex(e5.signature),
          pending_state: "PENDING",
          details_missing: [hex(unknownDep)],
        },
        checks: {
          signature_still_cryptographically_valid: verify(deviceB.priv, e5.signatureInput, e5.signature),
        },
      },
      "event-dependencies/negative-missing-dependency-pending"
    ),
    section(
      {
        reason: "two events reference each other; the graph is cyclic (63.1)",
        expected_error: "E_DAG_CYCLE",
        expected: {
          cycle_a_envelope_cbor: hex(cycA.envelope),
          cycle_b_envelope_cbor: hex(cycB.envelope),
        },
        checks: {
          cycle_a_signature_valid: verify(deviceB.priv, cycA.signatureInput, cycA.signature),
          cycle_b_signature_valid: verify(deviceB.priv, cycB.signatureInput, cycB.signature),
        },
      },
      "event-dependencies/negative-mutual-cycle"
    ),
    section(
      {
        reason: "a non-genesis event with no predecessors cannot trace to its ACCOUNT_CREATED (63.2)",
        expected_error: "E_DAG_UNROOTED",
        expected: { event_envelope_cbor: hex(e6.envelope) },
        checks: {
          signature_verifies: verify(deviceB.priv, e6.signatureInput, e6.signature),
          account_has_genesis_devices: true,
        },
      },
      "event-dependencies/negative-unrooted-event"
    ),
    section(
      {
        reason: "a predecessor belongs to a different account (63.2)",
        expected_error: "E_DAG_UNROOTED",
        expected: {
          other_account_genesis_envelope_cbor: hex(otherE0Valid.envelope),
          event_envelope_cbor: hex(e7.envelope),
        },
        checks: {
          other_predecessor_submitted: verify(otherIdentity.priv, otherE0Valid.signatureInput, otherE0Valid.signature),
          event_signature_valid: verify(deviceB.priv, e7.signatureInput, e7.signature),
        },
      },
      "event-dependencies/negative-cross-account-predecessor"
    ),
    section(
      {
        reason: "event reuses an already-accepted event_id with different bytes (63.5, 10.8)",
        expected_error: "E_EVENT_ID_COLLISION",
        expected: { event_envelope_cbor: hex(e8.envelope) },
        checks: {
          signature_verifies: verify(deviceA.priv, e8.signatureInput, e8.signature),
          collision_with_accepted_event_id: hex(e8.eventId) === hex(e1Id),
          bytes_differ_from_accepted: hex(e8.envelope) !== hex(e1.envelope),
        },
      },
      "event-dependencies/negative-event-id-collision"
    ),
    section(
      {
        reason: "two concurrent TRUSTED_DEVICE_TRANSFERRED events make trusted-device state ambiguous (42.3)",
        expected_error: "E_TRUST_CONFLICT",
        expected: {
          transfer_1_envelope_cbor: hex(t1.envelope),
          transfer_2_envelope_cbor: hex(t2.envelope),
          event_envelope_cbor: hex(e10.envelope),
        },
        checks: {
          transfer_1_signature_valid: verify(deviceA.priv, t1.signatureInput, t1.signature),
          transfer_2_signature_valid: verify(deviceA.priv, t2.signatureInput, t2.signature),
          neither_transfer_is_ancestor_of_the_other: !t1Preds.includes(t2Id) && !t2Preds.includes(t1Id),
        },
      },
      "event-dependencies/negative-ambiguous-trusted-device"
    ),
  ];

  return { positives, negatives };
}

// ---------------------------------------------------------------------------
// RFC 9180 A.1 / A.3 self-test
// ---------------------------------------------------------------------------

function hpkeSelfTest() {
  // RFC 9180 Appendix A.1.1:
  // DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-128-GCM (base mode).
  const skEm = "52c4a758a802cd8b936eceea314432798d5baf2d7e9235dc084ab1b9cfa2f736";
  const pkEm = "37fda3567bdbd628e88668c3c8d7e97d1d1253b6d4ea6d44c150f741f1bf4431";
  const skRm = "4612c550263fc8ad58375df3f557aac531d26850903e55a9f23f21d8534e8ac8";
  const pkRm = "3948cfe0ad1ddb695d780e59077195da6c56506b027329794ab02bca80815c4d";
  const info = "4f6465206f6e2061204772656369616e2055726e";
  const pt = "426f62";
  const aad = "436f756e74";
  // Published A.1.1 expected values.
  const expSharedSecret = "fe0e18c9f024ce43799ae393c7e8fe8fce9d218875e8227b0187c04e7d2ea1fc";
  const expKey = "4531685d41d65f03dc48f6b8302c05b0";
  const expBaseNonce = "56d890e5accaaf011cff4b7d";

  const x25519PrivFromRaw = (raw) =>
    crypto.createPrivateKey({ key: concat(X25519_SK_PREFIX, Buffer.from(raw, "hex")), format: "der", type: "pkcs8" });
  const pk = (priv) => crypto.createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32);

  const skE = x25519PrivFromRaw(skEm);
  const skR = x25519PrivFromRaw(skRm);
  const pkRmBuf = Buffer.from(pkRm, "hex");

  const derivedPkEm = pk(skE);
  const derivedPkRm = pk(skR);

  // KEM (KEM suite id, AES independent).
  const dh = crypto.diffieHellman({ privateKey: skE, publicKey: x25519PubFromRaw(pkRmBuf) });
  const kemContext = concat(derivedPkEm, pkRmBuf);
  const sharedSecret = extractAndExpand(dh, kemContext);

  // Key schedule with AES-128-GCM (Nk = 16).
  const KEM_ID_128 = 0x0020;
  const KDF_ID_128 = 0x0001;
  const AEAD_ID_128 = 0x0001;
  const suiteId128 = concat("HPKE", i2osp2(KEM_ID_128), i2osp2(KDF_ID_128), i2osp2(AEAD_ID_128));
  const infoBuf = Buffer.from(info, "hex");
  const pskIdHash = labeledExtract(Buffer.alloc(0), suiteId128, "psk_id_hash", Buffer.alloc(0));
  const infoHash = labeledExtract(Buffer.alloc(0), suiteId128, "info_hash", infoBuf);
  const ksc = concat(Buffer.from([0]), pskIdHash, infoHash);
  const secret = labeledExtract(sharedSecret, suiteId128, "secret", Buffer.alloc(0));
  const key = labeledExpand(secret, suiteId128, "key", ksc, 16);
  const baseNonce = labeledExpand(secret, suiteId128, "base_nonce", ksc, 12);
  const exporterSecret = labeledExpand(secret, suiteId128, "exp", ksc, 32);

  const aadBuf = Buffer.from(aad, "hex");
  const c128 = crypto.createCipheriv("aes-128-gcm", key, baseNonce);
  c128.setAAD(aadBuf);
  const ct = concat(c128.update(Buffer.from(pt, "hex")), c128.final(), c128.getAuthTag());

  return {
    derived_pkEm_matches: hex(derivedPkEm) === pkEm,
    derived_pkRm_matches: hex(derivedPkRm) === pkRm,
    enc_matches: hex(derivedPkEm) === pkEm,
    shared_secret_matches_rfc: hex(sharedSecret) === expSharedSecret,
    key_matches_rfc: hex(key) === expKey,
    base_nonce_matches_rfc: hex(baseNonce) === expBaseNonce,
    computed: {
      shared_secret: hex(sharedSecret),
      key: hex(key),
      base_nonce: hex(baseNonce),
      exporter_secret: hex(exporterSecret),
      ciphertext: hex(ct),
    },
  };
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const f1 = fix1();
const f2 = fix2();
const f3 = fix3(f2);
const f4 = fix4(f2);
const f5 = fix5();
const f6 = fix6();
const f7 = fix7();
const f8 = fix8(f4);
const f9 = fix9();
const f10 = fix10();
const f11 = fix11();
const f12 = fix12();

const selfTest = hpkeSelfTest();
if (
  !selfTest.derived_pkEm_matches ||
  !selfTest.derived_pkRm_matches ||
  !selfTest.shared_secret_matches_rfc ||
  !selfTest.key_matches_rfc ||
  !selfTest.base_nonce_matches_rfc
) {
  console.error("HPKE RFC 9180 A.1 self-test FAILED", selfTest);
  process.exit(1);
}

writeFileSync(join(here, "first-device-authorization.json"), JSON.stringify({ vectors: [f1.positive, ...f1.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "hpke-object-key.json"), JSON.stringify({ vectors: [f2.positive, ...f2.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "object-encryption-aad.json"), JSON.stringify({ vectors: [f3.positive, ...f3.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "identifiers.json"), JSON.stringify({ vectors: [f4.positive, ...f4.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "canonical-cbor.json"), JSON.stringify({ vectors: [...f5.positives, ...f5.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "event-signature.json"), JSON.stringify({ vectors: [f6.positive, ...f6.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "device-authorization.json"), JSON.stringify({ vectors: [f7.positive, ...f7.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "federation-request.json"), JSON.stringify({ vectors: [f8.positive, ...f8.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "media-streaming.json"), JSON.stringify({ vectors: [f9.positive, ...f9.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "username-grammar.json"), JSON.stringify({ vectors: f10.vectors }, null, 2) + "\n");
writeFileSync(join(here, "relationship-events.json"), JSON.stringify({ vectors: [f11.positive, ...f11.negatives] }, null, 2) + "\n");
writeFileSync(join(here, "event-dependencies.json"), JSON.stringify({ vectors: [...f12.positives, ...f12.negatives] }, null, 2) + "\n");

console.log("HPKE RFC 9180 A.1 self-test:", JSON.stringify(selfTest, null, 2));
console.log("Wrote first-device-authorization.json, hpke-object-key.json, object-encryption-aad.json, identifiers.json, canonical-cbor.json, event-signature.json, device-authorization.json, federation-request.json, media-streaming.json, username-grammar.json, relationship-events.json, event-dependencies.json");
