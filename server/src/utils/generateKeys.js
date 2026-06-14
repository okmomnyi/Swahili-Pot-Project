'use strict';

// One-time utility to generate the Ed25519 document-signing key pair.
// Run once, then copy the output into server/.env (replace real newlines with
// \n so each key fits on one line). NEVER commit the private key.
//
//   node src/utils/generateKeys.js

const { generateKeyPairSync } = require('crypto');

const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const oneLine = (pem) => pem.trim().replace(/\n/g, '\\n');

console.log('=== PRIVATE KEY (add to .env as DOCUMENT_SIGNING_PRIVATE_KEY) ===');
console.log(privateKey);
console.log('=== PUBLIC KEY (add to .env as DOCUMENT_SIGNING_PUBLIC_KEY) ===');
console.log(publicKey);

console.log('=== .env-ready one-line forms (newlines escaped) ===');
console.log(`DOCUMENT_SIGNING_PRIVATE_KEY="${oneLine(privateKey)}"`);
console.log(`DOCUMENT_SIGNING_PUBLIC_KEY="${oneLine(publicKey)}"`);

console.log('\nIMPORTANT: Store the private key securely. Never commit it to version control.');
console.log('The public key can be shared openly — publish it on your website if desired.');
