// Loopable Protocol 0.1 - test vector generator
//
// Deterministic generator for the vectors that cover the three blocking
// constructions: first-device authorization, HPKE object-key wrapping, and
// versioned-object AAD.
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

console.log("HPKE RFC 9180 A.1 self-test:", JSON.stringify(selfTest, null, 2));
console.log("Wrote first-device-authorization.json, hpke-object-key.json, object-encryption-aad.json");
