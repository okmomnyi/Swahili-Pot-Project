'use strict';

// override:true makes the .env file authoritative — so edits always take
// effect on restart even if a process manager (pm2) cached an older value.
require('dotenv').config({ override: true });

const { loadEnv } = require('./src/config/env');
const { checkS3 } = require('./src/lib/s3');
const { logMailConfig, verifyMailSetup } = require('./src/lib/mailer');

// 1. Validate environment — crashes the process if anything required is missing.
const env = loadEnv();

const app = require('./src/app');
const migrate = require('./src/db/migrate');
const startEscalationJob = require('./src/jobs/escalateDowntime');

async function start() {
  // 2. Ensure database tables exist.
  await migrate();

  // 3. Verify file storage so misconfiguration shows up clearly in the logs.
  await checkS3();

  // 3b. Log the active email + chat providers, and actively verify email so a
  //     bad key / unverified sender is obvious in the logs (non-blocking).
  logMailConfig();
  verifyMailSetup().catch(() => {});
  require('./src/routes/chat').logChatConfig();

  // 3c. Document signing status.
  const ds = require('./src/utils/documentSigner');
  if (ds.isSigningConfigured()) {
    console.log('[docsign] Ed25519 document signing ENABLED — generated PDFs are signed and verifiable.');
  } else if (process.env.DOCUMENT_SIGNING_PRIVATE_KEY || process.env.DOCUMENT_SIGNING_PUBLIC_KEY) {
    console.error(
      `[docsign] Keys are present but INVALID (${ds.signingKeyError()}) — PDFs will generate UNSIGNED. ` +
        'Fix the DOCUMENT_SIGNING_* values in .env: use the quoted one-line "\\n"-escaped form printed by ' +
        '`node src/utils/generateKeys.js` (an unquoted multi-line PEM is parsed incorrectly).'
    );
  } else {
    console.warn('[docsign] Document signing DISABLED (set DOCUMENT_SIGNING_PRIVATE_KEY + DOCUMENT_SIGNING_PUBLIC_KEY). PDFs generate without a verification footer.');
  }

  // 4. Start the server.
  app.listen(env.PORT, () => {
    console.log(`SwahiliPot IMS server running on port ${env.PORT}`);
  });

  // 5. Start the background downtime escalation job (runs every 30 minutes).
  startEscalationJob();
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
