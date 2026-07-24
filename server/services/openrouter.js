require('dotenv').config();

// 3-strategy JSON parser
function parseAIJson(text) {
  if (!text) return null;

  // Strategy 1: direct parse
  try { return JSON.parse(text); } catch (_) {}

  // Strategy 2: extract from markdown code block
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch (_) {}
  }

  // Strategy 3: extract first {...} or [...] block
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[1]); } catch (_) {}
  }

  return null;
}

async function callOpenRouter(prompt, systemPrompt = 'You are an expert SEO content writer and analyst.') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const baseUrl = String(process.env.OPENROUTER_BASE_URL || '').replace(/\/$/, '');

  if (!apiKey || !model || !baseUrl || apiKey === 'your_openrouter_api_key_here') throw new Error('OpenRouter runtime configuration is required');

  const data = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
      'X-Title': 'AI SEO Content Writer',
    },
    body: data,
  });
  if (!response.ok) throw new Error(`OpenRouter request failed with HTTP ${response.status}`);
  const parsed = await response.json();
  if (parsed.error) throw new Error(parsed.error.message || 'OpenRouter API error');
  const content = String(parsed.choices?.[0]?.message?.content || '').trim();
  if (!content) throw new Error('OpenRouter returned empty content');
  parsed.choices[0].message.content = content;
  return parsed;
}

module.exports = { callOpenRouter, parseAIJson };
