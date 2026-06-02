import type { ReviewContext } from '../context/buildReviewContext';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = 20000;

export interface RequestStructuredReviewOptions {
  reviewContext: ReviewContext;
}

export interface StructuredReviewSuccess {
  status: 'success';
  outputText: string;
}

export interface StructuredReviewSkipped {
  status: 'skipped';
  code: 'missing_api_key';
  message: string;
}

export interface StructuredReviewFailure {
  status: 'failed';
  code: 'timeout' | 'rate_limit' | 'provider_response_invalid' | 'request_failed';
  message: string;
}

export type StructuredReviewResult =
  | StructuredReviewSuccess
  | StructuredReviewSkipped
  | StructuredReviewFailure;

export interface LlmReviewClient {
  requestStructuredReview(
    options: RequestStructuredReviewOptions
  ): Promise<StructuredReviewResult>;
}

interface CreateOpenAiReviewClientOptions {
  apiKey?: string | null;
  apiUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function createOpenAiReviewClientFromEnvironment(
  options: Omit<CreateOpenAiReviewClientOptions, 'apiKey'> = {}
): LlmReviewClient {
  return createOpenAiReviewClient({
    ...options,
    apiKey: readOpenAiApiKeyFromEnvironment()
  });
}

export function readOpenAiApiKeyFromEnvironment(): string | null {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() || process.env.INPUT_OPENAI_API_KEY?.trim();

  return apiKey ? apiKey : null;
}

export function createOpenAiReviewClient(
  options: CreateOpenAiReviewClientOptions = {}
): LlmReviewClient {
  const apiKey = options.apiKey?.trim() || null;
  const fetchImplementation = options.fetch ?? fetch;
  const apiUrl = options.apiUrl ?? OPENAI_CHAT_COMPLETIONS_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async requestStructuredReview({
      reviewContext
    }: RequestStructuredReviewOptions): Promise<StructuredReviewResult> {
      if (!apiKey) {
        return {
          status: 'skipped',
          code: 'missing_api_key',
          message:
            'AI review skipped because the OpenAI API key was not available. This commonly happens when fork pull request secrets are unavailable.'
        };
      }

      const abortController = new AbortController();
      const timeoutHandle = setTimeout(() => {
        abortController.abort();
      }, timeoutMs);

      try {
        const response = await fetchImplementation(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: DEFAULT_OPENAI_MODEL,
            response_format: {
              type: 'json_object'
            },
            messages: buildReviewMessages(reviewContext)
          }),
          signal: abortController.signal
        });

        if (response.status === 429) {
          return {
            status: 'failed',
            code: 'rate_limit',
            message:
              'AI review degraded because the provider rate-limited the request.'
          };
        }

        if (!response.ok) {
          return {
            status: 'failed',
            code: 'request_failed',
            message:
              'AI review degraded because the provider request did not complete successfully.'
          };
        }

        const responseBody = (await response.json()) as unknown;
        const outputText = extractOutputText(responseBody);

        if (!outputText) {
          return {
            status: 'failed',
            code: 'provider_response_invalid',
            message:
              'AI review degraded because the provider response shape was invalid.'
          };
        }

        return {
          status: 'success',
          outputText
        };
      } catch (error) {
        if (isAbortError(error)) {
          return {
            status: 'failed',
            code: 'timeout',
            message:
              'AI review degraded because the provider request timed out.'
          };
        }

        return {
          status: 'failed',
          code: 'request_failed',
          message:
            'AI review degraded because the provider request did not complete successfully.'
        };
      } finally {
        clearTimeout(timeoutHandle);
      }
    }
  };
}

function buildReviewMessages(reviewContext: ReviewContext) {
  return [
    {
      role: 'system',
      content: [
        'You are reviewing a TypeScript pull request.',
        'Return JSON only and do not wrap it in markdown fences.',
        'Use this schema:',
        '{"summary_findings":[{"title":"string","severity":"low|medium|high|critical","confidence":0,"description":"string"}],"inline_findings":[{"message":"string","severity":"low|medium|high|critical","confidence":0,"file":"string","code_snippet":"string"}]}'
      ].join('\n')
    },
    {
      role: 'user',
      content: buildReviewPrompt(reviewContext)
    }
  ];
}

function buildReviewPrompt(reviewContext: ReviewContext): string {
  return [
    'Structured review context:',
    '',
    reviewContext.sections.pullRequestMetadata,
    '',
    reviewContext.sections.patchDiff,
    '',
    reviewContext.sections.fullFileContext,
    '',
    reviewContext.sections.reviewFocus,
    '',
    reviewContext.sections.outputSchemaInstructions,
    '',
    reviewContext.sections.metadataNotes
  ].join('\n');
}

function extractOutputText(value: unknown): string | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const choices = value.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const firstChoice = choices[0];

  if (!isPlainObject(firstChoice) || !isPlainObject(firstChoice.message)) {
    return null;
  }

  const content = firstChoice.message.content;

  return typeof content === 'string' && content.trim().length > 0
    ? content
    : null;
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error && error.name === 'AbortError'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
