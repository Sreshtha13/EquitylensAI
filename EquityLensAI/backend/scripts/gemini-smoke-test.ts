import { getEnv } from '../src/config/index.js';
import { GeminiClient } from '../src/ai/clients/gemini.js';

const smokeSchema = {
  type: 'OBJECT',
  properties: { ok: { type: 'BOOLEAN' } },
  required: ['ok'],
};

async function run(): Promise<void> {
  const env = getEnv();
  if (!env.AI_RESEARCH_ENABLED || !env.GEMINI_API_KEY) {
    throw new Error(
      'Set GEMINI_API_KEY and AI_RESEARCH_ENABLED=true in backend/.env before the smoke test.',
    );
  }

  const result = await new GeminiClient().generate({
    prompt: '{"task":"Return a JSON object with ok set to true."}',
    systemInstruction: 'Return only the requested JSON object.',
    responseJsonSchema: smokeSchema,
  });
  const parsed: unknown = JSON.parse(result.text);
  if (typeof parsed !== 'object' || parsed === null || !('ok' in parsed) || parsed.ok !== true) {
    throw new Error('The Gemini response failed the smoke-test contract.');
  }

  console.log(`Gemini smoke test passed (model: ${result.model}).`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Gemini smoke test failed.');
  process.exitCode = 1;
});
