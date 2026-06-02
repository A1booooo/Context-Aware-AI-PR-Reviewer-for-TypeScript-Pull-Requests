import { describe, expect, it, vi } from 'vitest';

import { generateStructuredReview } from '../../../src/review/llmReviewer';

describe('generateStructuredReview', () => {
  it('throws a clear error when OPENAI_API_KEY is missing', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    await expect(
      generateStructuredReview({
        prompt: 'Review this PR.',
        fetchImpl: vi.fn()
      })
    ).rejects.toThrow('OPENAI_API_KEY is required to generate AI review results.');

    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it('calls the OpenAI Responses API and parses the returned JSON', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        output_text:
          '```json\n{"summary":"Review complete.","findings":[],"test_suggestions":["Add regression coverage."]}\n```'
      })
    }));

    const result = await generateStructuredReview({
      prompt: 'Review this PR.',
      apiKey: 'test-key',
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json'
        }),
        body: expect.any(String),
        signal: expect.any(AbortSignal)
      })
    );
    expect(result).toEqual({
      summary: 'Review complete.',
      findings: [],
      test_suggestions: ['Add regression coverage.']
    });
  });
});
