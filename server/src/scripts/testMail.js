'use strict';

// Send a test email to verify the configured provider (Brevo) actually delivers.
// Usage:  node src/scripts/testMail.js you@example.com
//   or:   npm run mail:test -- you@example.com

require('dotenv').config({ override: true });
const { sendMail, provider, getSender } = require('../lib/mailer');

const to = process.argv[2];
if (!to || !to.includes('@')) {
  console.error('Usage: node src/scripts/testMail.js <recipient@example.com>');
  process.exit(1);
}

const sender = getSender();
console.log(`Provider: ${provider()}`);
console.log(`Sender:   ${sender.name} <${sender.email}>`);
console.log(`Sending test email to: ${to} ...\n`);

sendMail({
  to,
  subject: 'SwahiliPot IMS — test email',
  text: 'If you can read this, email delivery is working. — SwahiliPot IMS',
  html:
    '<div style="font-family:sans-serif">' +
    '<h2 style="color:#1e40af">SwahiliPot IMS</h2>' +
    '<p>If you can read this, your email delivery is working. ✅</p>' +
    '</div>',
})
  .then((sent) => {
    if (sent) {
      console.log('\n✅ Accepted by the provider.');
      console.log('   Now check: (1) the inbox AND spam/promotions folder of', to);
      console.log('   (2) Brevo dashboard > Transactional > Email > Logs for the delivery status.');
    } else {
      console.log('\n⚠️  No email provider configured (set BREVO_API_KEY).');
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Send FAILED:', err.message);
    console.error('   Common causes: sender not verified in Brevo, wrong API key, or a daily limit.');
    process.exit(1);
  });
