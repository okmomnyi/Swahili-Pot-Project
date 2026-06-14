'use strict';

// PUBLIC document verification — NO authentication on any route here. Anyone who
// receives a SwahiliPot document (a university, employer, or government officer)
// can look it up, download the public key, and upload the PDF to detect tampering.

const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const verifyToken = require('../middleware/auth');
const { getPublicKeyPem, verifyHash, verifyDocument } = require('../utils/documentSigner');

const router = express.Router();

// Uploaded PDF is held in MEMORY only — never written to disk.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// GET /api/verify/public-key — download the Ed25519 public key (PEM).
router.get('/public-key', (req, res) => {
  const pem = getPublicKeyPem();
  if (!pem) return res.status(503).json({ error: 'Document signing is not configured.' });
  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', 'attachment; filename="swahilipot-hub-public-key.pem"');
  return res.send(pem);
});

// POST /api/verify/check — upload a PDF + document_id; report authenticity.
router.post('/check', memoryUpload.single('file'), async (req, res, next) => {
  try {
    const documentId = (req.body && req.body.document_id ? String(req.body.document_id) : '').trim();
    if (!documentId || !req.file) {
      return res.status(400).json({ error: 'Both document_id and a PDF file are required.' });
    }

    const { rows: [record] } = await pool.query(
      `SELECT document_id, content_hash, signature, issued_at, is_revoked,
              recipient_name, department_name, issued_by_name, document_type
         FROM documents WHERE document_id = $1`,
      [documentId]
    );

    if (!record) {
      return res.json({
        result: 'NOT_FOUND',
        message: 'No document with this ID exists in the SwahiliPot IMS records.',
      });
    }

    if (record.is_revoked) {
      return res.json({
        result: 'REVOKED',
        message: 'This document has been officially revoked. It is no longer valid.',
        document_id: record.document_id,
        recipient_name: record.recipient_name,
      });
    }

    const { hashMatch, computedHash } = verifyHash(req.file.buffer, record.content_hash);

    if (hashMatch) {
      const { valid } = verifyDocument(req.file.buffer, record.document_id, record.issued_at, record.signature);
      return res.json({
        result: valid ? 'AUTHENTIC' : 'SIGNATURE_INVALID',
        message: valid
          ? 'This document is authentic. Its content matches the original and the digital signature is valid.'
          : 'The document content matches but the signature could not be verified. Contact SwahiliPot Hub Foundation.',
        document_id: record.document_id,
        recipient_name: record.recipient_name,
        department_name: record.department_name,
        issued_by_name: record.issued_by_name,
        document_type: record.document_type,
        issued_at: record.issued_at,
        hash_verified: hashMatch,
        signature_verified: valid,
      });
    }

    return res.json({
      result: 'TAMPERED',
      message:
        'WARNING: This document has been altered. Its content does not match the original issued by SwahiliPot Hub Foundation.',
      document_id: record.document_id,
      recipient_name: record.recipient_name,
      hash_verified: false,
      signature_verified: false,
      computed_hash: computedHash,
      stored_hash: record.content_hash,
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/verify/:document_id/history — internal (auth required). Basic record
// detail for the admin/supervisor document panels.
router.get('/:document_id/history', verifyToken, async (req, res, next) => {
  try {
    const { rows: [doc] } = await pool.query(
      `SELECT document_id, document_type, recipient_name, department_name,
              issued_by_name, issued_by_role, issued_at, content_hash, signature,
              is_revoked, revoked_at, revocation_reason
         FROM documents WHERE document_id = $1`,
      [req.params.document_id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    return res.json({ document: doc });
  } catch (err) {
    return next(err);
  }
});

// GET /api/verify/:document_id — public provenance lookup.
// (Declared last so it doesn't shadow /public-key or /check.)
router.get('/:document_id', async (req, res, next) => {
  try {
    const { rows: [doc] } = await pool.query(
      `SELECT document_id, document_type, recipient_name, department_name,
              issued_by_name, issued_by_role, issued_at, content_hash, signature,
              is_revoked, revoked_at, revocation_reason
         FROM documents WHERE document_id = $1`,
      [req.params.document_id]
    );

    if (!doc) {
      return res.status(404).json({ error: 'Document not found.', verified: false });
    }

    if (doc.is_revoked) {
      return res.json({
        verified: false,
        revoked: true,
        document_id: doc.document_id,
        document_type: doc.document_type,
        recipient_name: doc.recipient_name,
        department_name: doc.department_name,
        issued_by_name: doc.issued_by_name,
        issued_by_role: doc.issued_by_role,
        issued_at: doc.issued_at,
        revoked_at: doc.revoked_at,
        revocation_reason: doc.revocation_reason,
        content_hash: doc.content_hash,
        signature: doc.signature,
      });
    }

    return res.json({
      verified: true,
      revoked: false,
      document_id: doc.document_id,
      document_type: doc.document_type,
      recipient_name: doc.recipient_name,
      department_name: doc.department_name,
      issued_by_name: doc.issued_by_name,
      issued_by_role: doc.issued_by_role,
      issued_at: doc.issued_at,
      content_hash: doc.content_hash,
      signature: doc.signature,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
