'use strict';

// Ed25519 document signing. Ed25519 is built into Node's crypto module, so no
// external packages are needed. The keys are PEM strings in the environment
// (newlines stored as literal "\n"); signing is gracefully disabled when they
// are absent so the server still boots.

// Ed25519 is a *pure* signature scheme (no separate message digest), so it must
// use the one-shot crypto.sign/verify with algorithm = null — NOT the
// createSign('SHA256') streaming API or ECDSA's dsaEncoding option.
const {
  sign: edSign, verify: edVerify, createHash, randomBytes,
  createPrivateKey, createPublicKey,
} = require('crypto');

function privatePem() {
  const k = process.env.DOCUMENT_SIGNING_PRIVATE_KEY;
  return k ? k.replace(/\\n/g, '\n') : null;
}
function publicPem() {
  const k = process.env.DOCUMENT_SIGNING_PUBLIC_KEY;
  return k ? k.replace(/\\n/g, '\n') : null;
}

// Validate the keys actually PARSE — not just that the env vars exist. A present
// but malformed PEM (bad quoting/newlines in .env) would otherwise pass the
// presence check and then throw deep inside signing. Cached and recomputed only
// if the env values change.
let _cache = { priv: undefined, pub: undefined, valid: false, error: null };
function validateKeys() {
  const priv = privatePem();
  const pub = publicPem();
  if (_cache.priv === priv && _cache.pub === pub) return _cache;
  const c = { priv, pub, valid: false, error: null };
  if (!priv || !pub) {
    c.error = 'keys not set';
  } else {
    try {
      createPrivateKey(priv);
      createPublicKey(pub);
      c.valid = true;
    } catch (e) {
      c.error = e.message;
    }
  }
  _cache = c;
  return c;
}

/** True only when both keys are present AND parse as valid Ed25519 PEMs. */
function isSigningConfigured() {
  return validateKeys().valid;
}

/** Returns a human-readable error if the keys are missing/invalid, else null. */
function signingKeyError() {
  return validateKeys().error;
}

/**
 * Unique Document ID: SPH-[YEAR]-[TYPE_CODE]-[6 random hex, uppercase].
 */
function generateDocumentId(documentType) {
  const year = new Date().getFullYear();
  const typeCodes = {
    attachment_letter: 'ATT',
    completion_certificate: 'CPL',
    progress_report: 'PRG',
    completion_letter: 'CLT',
    trainee_certificate: 'TRN',
    general: 'GEN',
  };
  const code = typeCodes[documentType] || 'DOC';
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `SPH-${year}-${code}-${random}`;
}

/** SHA-256 hash of a Buffer or string, as hex. */
function hashContent(content) {
  return createHash('sha256')
    .update(typeof content === 'string' ? Buffer.from(content) : content)
    .digest('hex');
}

/**
 * Sign a document. The signed payload binds the content hash to the document ID
 * and timestamp, so a signature can't be transplanted onto another document.
 * Returns { contentHash, signature, signedPayload }.
 */
function signDocument(pdfBytes, documentId, issuedAt) {
  const contentHash = hashContent(pdfBytes);
  const signedPayload = `${documentId}|${contentHash}|${issuedAt}`;

  const key = privatePem();
  if (!key) throw new Error('Document signing is not configured (DOCUMENT_SIGNING_PRIVATE_KEY missing).');

  // Ed25519: algorithm is null; the 64-byte signature is returned directly.
  const signatureBuffer = edSign(null, Buffer.from(signedPayload), key);
  const signature = 'SPH-SIG-' + signatureBuffer.toString('base64url');

  return { contentHash, signature, signedPayload };
}

/**
 * Verify a document signature against the stored record.
 * Returns { valid, contentHash }.
 */
function verifyDocument(pdfBytes, documentId, issuedAt, storedSignature) {
  const contentHash = hashContent(pdfBytes);
  const signedPayload = `${documentId}|${contentHash}|${issuedAt}`;

  const key = publicPem();
  if (!key) return { valid: false, contentHash };

  try {
    const rawSignature = String(storedSignature || '').replace(/^SPH-SIG-/, '');
    const signatureBuffer = Buffer.from(rawSignature, 'base64url');
    const valid = edVerify(null, Buffer.from(signedPayload), key, signatureBuffer);
    return { valid, contentHash };
  } catch {
    return { valid: false, contentHash };
  }
}

/** Quick integrity check: does the PDF hash match the stored hash? */
function verifyHash(pdfBytes, storedHash) {
  const computedHash = hashContent(pdfBytes);
  return { hashMatch: computedHash === storedHash, computedHash, storedHash };
}

/** The public key PEM (for the public download endpoint). */
function getPublicKeyPem() {
  return publicPem();
}

module.exports = {
  isSigningConfigured,
  signingKeyError,
  generateDocumentId,
  hashContent,
  signDocument,
  verifyDocument,
  verifyHash,
  getPublicKeyPem,
};
