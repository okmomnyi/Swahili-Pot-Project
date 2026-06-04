'use strict';

const nodemailer = require('nodemailer');

// "Name <email>" -> { name, email }
function parseAddress(value) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value || '');
  if (m) return { name: (m[1] || '').trim() || undefined, email: m[2].trim() };
  if (value && value.includes('@')) return { name: undefined, email: value.trim() };
  return { name: undefined, email: undefined };
}

// Resolve the verified sender. MAIL_FROM_EMAIL/NAME take priority, then SMTP_FROM.
function getSender() {
  const parsed = parseAddress(process.env.SMTP_FROM);
  return {
    email: process.env.MAIL_FROM_EMAIL || parsed.email || 'no-reply@swahilipothub.co.ke',
    name: process.env.MAIL_FROM_NAME || parsed.name || 'SwahiliPot IMS',
  };
}

/** Which provider is active: 'brevo' | 'smtp' | 'none'. */
function provider() {
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.SMTP_HOST) return 'smtp';
  return 'none';
}

function isConfigured() {
  return provider() !== 'none';
}

// ---- Brevo transactional HTTP API (https / port 443) ----
async function sendViaBrevo({ to, subject, html, text }) {
  const sender = getSender();
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html || `<pre>${text || ''}</pre>`,
      textContent: text || undefined,
    }),
  });

  const raw = await res.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { /* keep raw */ }

  if (!res.ok) {
    // Surface Brevo's exact reason (e.g. "Sender not valid", "IP not authorized").
    throw new Error(`Brevo API ${res.status} ${body.code || ''}: ${body.message || raw}`.trim());
  }
  return body.messageId || 'accepted';
}

// ---- SMTP fallback (with timeouts so it can't hang) ----
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  return transporter;
}

/**
 * Send an email. Prefers Brevo's HTTP API (works where SMTP ports are blocked).
 * Throws on failure with the provider's exact reason. Logs the Brevo message id
 * on success so delivery can be traced in Brevo > Transactional > Logs.
 */
async function sendMail({ to, subject, html, text }) {
  const which = provider();

  if (which === 'brevo') {
    const id = await sendViaBrevo({ to, subject, html, text });
    console.log(`[mail] Brevo accepted message to ${to} (id: ${id})`);
    return true;
  }

  if (which === 'smtp') {
    const tx = getTransporter();
    const sender = getSender();
    const from = sender.name ? `${sender.name} <${sender.email}>` : sender.email;
    const info = await tx.sendMail({ from, to, subject, html, text });
    console.log(`[mail] SMTP accepted message to ${to} (${info.messageId || 'ok'})`);
    return true;
  }

  console.error(`[mail] No email provider configured — would have sent to ${to}: ${subject}`);
  return false;
}

/** Log the active mail configuration at startup. */
function logMailConfig() {
  const which = provider();
  const sender = getSender();
  if (which === 'brevo') {
    console.log(`[mail] Using Brevo HTTP API — sender ${sender.name} <${sender.email}>.`);
  } else if (which === 'smtp') {
    console.log(`[mail] Using SMTP (${process.env.SMTP_HOST}) — sender <${sender.email}>.`);
  } else {
    console.log('[mail] No email provider configured — reset links are logged to the console.');
  }
}

module.exports = { sendMail, isConfigured, provider, getSender, logMailConfig };
