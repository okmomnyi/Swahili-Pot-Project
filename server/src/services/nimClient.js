'use strict';

const OpenAI = require('openai');

// NVIDIA NIM is fully OpenAI-compatible — just swap baseURL and key.
const KIMI_MODEL = process.env.NVIDIA_NIM_MODEL || 'moonshotai/kimi-k2-instruct';

const SYSTEM_PROMPT = `You are an expert HR analyst and career advisor embedded in the Swahilipot Hub Foundation's internal management system.
Swahilipot is a youth-empowerment NGO in Mombasa, Kenya that runs attachment (internship) programs across departments: Tech, Communication, Creatives, Community Experience, Youth Engagement, Heritage, Finance, Admin, and Entrepreneurship.

You analyse real data from the system — attendance records, submission histories, supervisor notes, and task logs.
You NEVER invent data, make up names, or speculate about things not present in the provided context.
You write in a professional but warm tone appropriate for a Kenyan NGO context.
When referencing skills, career paths, or opportunities, prioritise the Kenyan tech and creative ecosystem.`;

// Lazily construct the client so a missing key never crashes server boot.
let _client = null;

function isConfigured() {
  return Boolean(process.env.NVIDIA_NIM_API_KEY);
}

function getNimClient() {
  if (!isConfigured()) {
    const err = new Error('NVIDIA_NIM_API_KEY is not configured');
    err.code = 'AI_NOT_CONFIGURED';
    throw err;
  }
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.NVIDIA_NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
      apiKey: process.env.NVIDIA_NIM_API_KEY,
    });
  }
  return _client;
}

module.exports = { getNimClient, isConfigured, KIMI_MODEL, SYSTEM_PROMPT };
