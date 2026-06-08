'use strict';

const OpenAI = require('openai');

const uniq = (arr) => arr.filter((v, i, a) => v && a.indexOf(v) === i);

// Models tried in order (first that responds wins). Kimi K2 reached end-of-life
// on NVIDIA NIM (2026-05-12, HTTP 410) so it is NOT in this list. Override the
// primary with NVIDIA_NIM_MODEL if needed.
const NIM_MODELS = uniq([
  process.env.NVIDIA_NIM_MODEL,
  'meta/llama-3.3-70b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'mistralai/mistral-7b-instruct-v0.3',
]);

const SYSTEM_PROMPT = `You are an expert HR analyst and career advisor embedded in the Swahilipot Hub Foundation's internal management system.
Swahilipot is a youth-empowerment NGO in Mombasa, Kenya that runs attachment (internship) programs across departments: Tech, Communication, Creatives, Community Experience, Youth Engagement, Heritage, Finance, Admin, and Entrepreneurship.

You analyse real data from the system — attendance records, submission histories, supervisor notes, and task logs.
You NEVER invent data, make up names, or speculate about things not present in the provided context.
You write in a professional but warm tone appropriate for a Kenyan NGO context.
When referencing skills, career paths, or opportunities, prioritise the Kenyan tech and creative ecosystem.`;

// Resolve the key: prefer the dedicated AI key, fall back to the chatbot's key
// so the AI layer works as soon as either is configured.
function getKey() {
  return process.env.NVIDIA_NIM_API_KEY || process.env.NVIDIA_API_KEY || null;
}

function isConfigured() {
  return Boolean(getKey());
}

// Lazily construct so a missing key never crashes server boot.
let _client = null;
let _clientKey = null;

function getNimClient() {
  const key = getKey();
  if (!key) {
    const err = new Error('NVIDIA NIM is not configured');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  if (!_client || _clientKey !== key) {
    _client = new OpenAI({
      baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      apiKey: key,
    });
    _clientKey = key;
  }
  return _client;
}

// Errors worth falling through to the next model for (rate limit, gone, not
// found, server errors). 401/403 are key problems — stop immediately.
function isRetriable(status) {
  return status === 404 || status === 410 || status === 429 || (status >= 500 && status < 600);
}

module.exports = { getNimClient, isConfigured, NIM_MODELS, SYSTEM_PROMPT, isRetriable };
