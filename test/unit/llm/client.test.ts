import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createOpenAiReviewClient,
  createOpenAiReviewClientFromEnvironment
} from '../../../src/llm/client';
import type { ReviewContext } from '../../../src/context/buildReviewContext';

function createReviewContextFixture(): ReviewContext {
  return {
    metadata: {
      includedFilesCount: 1,
      excludedFilesCount: 0,
      truncatedFilesCount: 0,
      truncatedFiles: [],
      totalPatchCharacters: 24,
      fullFileContext: {
        requested: false,
        mode: 'patch_only',
        reason: 'disabled_in_config',
        includedFilesCount: 0
      },
      notes: ['No included patches required truncation.']
    },
    sections: {
      pullRequestMetadata: 'PR #42: Improve file loading',
      patchDiff: 'File: src/feature.ts\n@@ -1 +1 @@\n-old\n+new',
      fullFileContext: 'Full file context omitted.',
      reviewFocus: 'Configured review focus (preserve this order): bug-risk',
      outputSchemaInstructions: 'Return deterministic JSON only.',
      metadataNotes: 'Metadata and truncation notes:\n- No included patches required truncation.'
    }
  };
}

describe('createOpenAiReviewClient', () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.INPUT_OPENAI_API_KEY;
    delete process.env.LLM_API_URL;
    delete process.env.INPUT_LLM_API_URL;
    delete process.env.LLM_MODEL;
    delete process.env.INPUT_LLM_MODEL;
  });

  it('returns model text when the provider request succeeds', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"summary_findings":[],"inline_findings":[]}'
              }
            }
          ]
        })
      } as Response;
    });

    const client = createOpenAiReviewClient({
      apiKey: 'test-key',
      fetch: fetchMock
    });

    await expect(
      client.requestStructuredReview({
        reviewContext: createReviewContextFixture()
      })
    ).resolves.toEqual({
      status: 'success',
      outputText: '{"summary_findings":[],"inline_findings":[]}'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST'
      })
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      'Structured review context:'
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"model":"gpt-4.1-mini"'
    );
  });

  it('skips safely when no API key is configured', async () => {
    const client = createOpenAiReviewClient({
      apiKey: null,
      fetch: vi.fn()
    });

    await expect(
      client.requestStructuredReview({
        reviewContext: createReviewContextFixture()
      })
    ).resolves.toEqual({
      status: 'skipped',
      code: 'missing_api_key',
      message:
        'AI review skipped because the OpenAI API key was not available. This commonly happens when fork pull request secrets are unavailable.'
    });
  });

  it('returns a timeout failure when the provider request aborts', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';

    const client = createOpenAiReviewClient({
      apiKey: 'test-key',
      fetch: vi.fn(async () => {
        throw abortError;
      })
    });

    await expect(
      client.requestStructuredReview({
        reviewContext: createReviewContextFixture()
      })
    ).resolves.toEqual({
      status: 'failed',
      code: 'timeout',
      message: 'AI review degraded because the provider request timed out.'
    });
  });

  it('returns a rate-limit failure when the provider responds with 429', async () => {
    const client = createOpenAiReviewClient({
      apiKey: 'test-key',
      fetch: vi.fn(async () => {
        return {
          ok: false,
          status: 429,
          json: async () => ({})
        } as Response;
      })
    });

    await expect(
      client.requestStructuredReview({
        reviewContext: createReviewContextFixture()
      })
    ).resolves.toEqual({
      status: 'failed',
      code: 'rate_limit',
      message: 'AI review degraded because the provider rate-limited the request.'
    });
  });

  it('returns a provider response invalid failure when model text is missing', async () => {
    const client = createOpenAiReviewClient({
      apiKey: 'test-key',
      fetch: vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: null
                }
              }
            ]
          })
        } as Response;
      })
    });

    await expect(
      client.requestStructuredReview({
        reviewContext: createReviewContextFixture()
      })
    ).resolves.toEqual({
      status: 'failed',
      code: 'provider_response_invalid',
      message:
        'AI review degraded because the provider response shape was invalid.'
    });
  });

  it('reads the API key from OPENAI_API_KEY before the action input fallback', async () => {
    process.env.OPENAI_API_KEY = 'preferred-key';
    process.env.INPUT_OPENAI_API_KEY = 'fallback-key';

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"summary_findings":[],"inline_findings":[]}'
              }
            }
          ]
        })
      } as Response;
    });

    const client = createOpenAiReviewClientFromEnvironment({
      fetch: fetchMock
    });

    await client.requestStructuredReview({
      reviewContext: createReviewContextFixture()
    });

    const requestHeaders = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;

    expect(requestHeaders.Authorization).toContain('preferred-key');
    expect(requestHeaders.Authorization).not.toContain('fallback-key');
  });

  it('reads the API URL override from environment', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"summary_findings":[],"inline_findings":[]}'
              }
            }
          ]
        })
      } as Response;
    });

    const client = createOpenAiReviewClientFromEnvironment({
      fetch: fetchMock
    });

    await client.requestStructuredReview({
      reviewContext: createReviewContextFixture()
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.minimax.chat/v1/text/chatcompletion_v2'
    );
  });

  it('reads the model override from environment', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_MODEL = 'MiniMax-Text-01';

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"summary_findings":[],"inline_findings":[]}'
              }
            }
          ]
        })
      } as Response;
    });

    const client = createOpenAiReviewClientFromEnvironment({
      fetch: fetchMock
    });

    await client.requestStructuredReview({
      reviewContext: createReviewContextFixture()
    });

    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"model":"MiniMax-Text-01"'
    );
  });

  it('prefers explicit API URL and model options over environment overrides', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.LLM_API_URL = 'https://env.example/v1/chat/completions';
    process.env.LLM_MODEL = 'env-model';

    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"summary_findings":[],"inline_findings":[]}'
              }
            }
          ]
        })
      } as Response;
    });

    const client = createOpenAiReviewClientFromEnvironment({
      apiUrl: 'https://override.example/v1/chat/completions',
      model: 'override-model',
      fetch: fetchMock
    });

    await client.requestStructuredReview({
      reviewContext: createReviewContextFixture()
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://override.example/v1/chat/completions'
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
      '"model":"override-model"'
    );
  });

  it('keeps missing API key behavior unchanged even when URL and model overrides exist', async () => {
    process.env.LLM_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
    process.env.LLM_MODEL = 'MiniMax-Text-01';

    const fetchMock = vi.fn();
    const client = createOpenAiReviewClientFromEnvironment({
      fetch: fetchMock
    });

    await expect(
      client.requestStructuredReview({
        reviewContext: createReviewContextFixture()
      })
    ).resolves.toEqual({
      status: 'skipped',
      code: 'missing_api_key',
      message:
        'AI review skipped because the OpenAI API key was not available. This commonly happens when fork pull request secrets are unavailable.'
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
