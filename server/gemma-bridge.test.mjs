import { describe, expect, it } from 'vitest';
import { classifyGeminiError, pickBackupModels } from './gemma-bridge.mjs';

const err = (status, message, extra = '') => JSON.stringify({ error: { code: status, message: message + extra } });

describe('Gemini errors', () => {
  it('a model the free tier cannot use is skipped, not retried, and does not stop the others', () => {
    const t = err(429, 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-2.5-flash');
    expect(classifyGeminiError(429, t).type).toBe('not-allowed');
    expect(classifyGeminiError(404, err(404, 'models/gemini-2.5-flash is not found')).type).toBe('not-allowed');
    expect(classifyGeminiError(403, err(403, 'Permission denied')).type).toBe('not-allowed');
    expect(classifyGeminiError(400, err(400, 'This model is not available on the free tier')).type).toBe('not-allowed');
  });

  it('overload and short rate limits are retried', () => {
    expect(classifyGeminiError(503, err(503, 'The model is overloaded')).type).toBe('busy');
    expect(classifyGeminiError(429, err(429, 'Resource exhausted, please retry in 3s')).type).toBe('busy');
  });

  it('a bad key stops immediately', () => {
    expect(classifyGeminiError(400, err(400, 'API key not valid. Please pass a valid API key.', ' API_KEY_INVALID')).type).toBe('bad-key');
  });
});

describe('backup models', () => {
  it('keeps the primary first, then newer Flash before older, Flash before Lite, and ignores other kinds', () => {
    const gen = ['generateContent'];
    const list = [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.6-flash-lite', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.5-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.6-flash-image', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.6-pro', supportedGenerationMethods: gen },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    ];
    expect(pickBackupModels(list, 'gemini-3.6-flash')).toEqual(['gemini-3.6-flash', 'gemini-3.6-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash']);
  });
});
