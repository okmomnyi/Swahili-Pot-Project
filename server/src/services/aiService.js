'use strict';

const { getNimClient, KIMI_MODEL, SYSTEM_PROMPT } = require('./nimClient');

/**
 * Generate the full intelligence profile for one attachee.
 * Returns a parsed JSON object.
 */
async function generateAttacheeProfile(attacheeContext) {
  const prompt = `You are producing a DETAILED, comprehensive attachee intelligence profile for a supervisor to make quality assessments. Be thorough and specific — cite the actual numbers from the data (attendance counts, percentages, arrival times, streaks, trends) in your reasoning. Longer, evidence-backed assessments are strongly preferred over short ones.

ATTACHEE DATA:
${attacheeContext}

Respond ONLY with a single valid JSON object — no markdown fences, no extra text, no preamble. Use this EXACT structure:
{
  "summary": "A rich 4-6 sentence narrative overall assessment of this attachee, weaving in concrete figures from the data.",
  "overall_rating": "one of: Excellent | Strong | Developing | Needs Support",
  "engagement_score": 0-100,
  "headline": "One punchy sentence capturing who this attachee is.",
  "strengths": ["5 to 7 specific, evidence-backed strengths, each citing data"],
  "weaknesses": ["3 to 5 specific growth areas, each grounded in the data"],
  "behavioral_patterns": ["4 to 6 observed patterns (punctuality, rhythm, consistency, day-of-week tendencies, trend)"],
  "attendance_assessment": "A detailed paragraph (4-6 sentences) analysing attendance volume, consistency, punctuality and trend, citing the numbers.",
  "punctuality": "A 1-2 sentence assessment of punctuality grounded in arrival-time figures.",
  "consistency": "A 1-2 sentence assessment of consistency grounded in streak/weeks/trend figures.",
  "work_themes": ["themes/skills inferred from the reported 'tasks completed' notes; empty array if none were recorded"],
  "skill_tags": ["6 to 10 skill tags inferred cautiously from attendance reliability, reported work, and programme context"],
  "career_paths": [
    {
      "title": "Career Path Title (Kenyan tech/creative ecosystem where relevant)",
      "confidence": 0-100,
      "reasoning": "2-3 sentences on why this fits THIS attachee specifically, referencing their data.",
      "next_steps": ["3 to 4 concrete next steps"],
      "relevant_skills": ["2 to 4 skills that support this path"]
    }
  ],
  "recommendations": ["4 to 6 concrete, actionable recommendations for the supervisor"],
  "risk_flags": ["any concerns e.g. 'Declining attendance over the last two weeks'; use [] if none"]
}

Rules:
- Ground EVERY claim in the provided data. Cite specific numbers where possible. Do NOT invent submissions, grades, or task outcomes that are not shown.
- career_paths: exactly 3, ordered by confidence descending.
- If data is thin, say so honestly in the relevant fields and keep confidence modest — but still fill every field.
- Return ONLY the JSON object.`;

  const response = await getNimClient().chat.completions.create({
    model: KIMI_MODEL,
    max_tokens: 4000,
    temperature: 0.5,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const raw = response.choices[0].message.content.trim();
  // Strip markdown fences and isolate the JSON object if the model adds prose.
  let clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first > 0 || last < clean.length - 1) clean = clean.slice(first, last + 1);
  return JSON.parse(clean);
}

/**
 * Generate a narrative paragraph block for a progress or completion report.
 * Returns a plain string.
 */
async function generateReportNarrative(attacheeContext, reportType) {
  const isCompletion = reportType === 'completion';

  const prompt = `Based on the following attachee data, write a professional ${isCompletion ? 'attachment completion letter narrative' : 'mid-attachment progress report'}.

ATTACHEE DATA:
${attacheeContext}

${isCompletion
  ? `Write exactly 3 paragraphs:
1. Introduction: confirm completion of attachment, mention department and approximate duration
2. Performance summary: key strengths demonstrated, attendance reliability
3. Closing commendation: their contribution to the department and a recommendation statement`
  : `Write exactly 3 paragraphs:
1. Progress to date: attendance performance so far
2. Identified strengths and growth areas based on the available data
3. Recommendations for the remainder of the attachment period`}

Rules:
- Formal, professional English appropriate for a Kenyan NGO document.
- Only reference facts present in the data — do NOT invent details.
- Use the attachee's actual name throughout.
- Output body paragraphs only — no salutation, no sign-off, no headers.`;

  const response = await getNimClient().chat.completions.create({
    model: KIMI_MODEL,
    max_tokens: 1200,
    temperature: 0.6,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  return response.choices[0].message.content.trim();
}

/**
 * Supervisor AI assistant — streaming.
 * Calls onChunk(text) for each streamed token, returns the full response.
 */
async function streamSupervisorAnswer({ question, departmentContext, chatHistory, onChunk }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...chatHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: `DEPARTMENT CONTEXT:\n${departmentContext}\n\nQUESTION: ${question}`,
    },
  ];

  const stream = await getNimClient().chat.completions.create({
    model: KIMI_MODEL,
    max_tokens: 600,
    temperature: 0.6,
    messages,
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullText += delta;
      onChunk(delta);
    }
  }
  return fullText;
}

module.exports = { generateAttacheeProfile, generateReportNarrative, streamSupervisorAnswer };
