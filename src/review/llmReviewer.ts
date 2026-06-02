import { REVIEW_RESULT_JSON_SCHEMA, parseReviewJson, type ReviewResult } from './reviewSchema';

const DEFAULT_OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_TIMEOUT_MS = 30_000;

const REVIEW_SYSTEM_PROMPT = [
  'You are an expert TypeScript pull request reviewer.',
  'Return only valid JSON that matches the requested schema.',
  'Do not wrap the response in markdown unless the API forces it.'
].join(' ');

export interface GenerateStructuredReviewOptions {
  prompt: string;
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function generateStructuredReview(
  options: GenerateStructuredReviewOptions
): Promise<ReviewResult> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate AI review results.');
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch implementation is required to call the OpenAI API.');
  }

  const response = await fetchImpl(options.apiUrl ?? DEFAULT_OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: REVIEW_SYSTEM_PROMPT }]
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: options.prompt }]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'review_result',
          schema: REVIEW_RESULT_JSON_SCHEMA
        }
      }
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  });

  const responseBody = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(buildApiErrorMessage(response.status, responseBody));
  }

  const responseText = extractResponseText(responseBody);

  if (!responseText) {
    throw new Error('OpenAI API returned an empty response body.');
  }

  return parseReviewJson(responseText);
}

function extractResponseText(responseBody: unknown): string {
  if (isPlainObject(responseBody) && typeof responseBody.output_text === 'string') {
    return responseBody.output_text;
  }

  if (isPlainObject(responseBody) && Array.isArray(responseBody.output)) {
    const parts: string[] = [];

    for (const outputItem of responseBody.output) {
      if (!isPlainObject(outputItem) || !Array.isArray(outputItem.content)) {
        continue;
      }

      for (const contentItem of outputItem.content) {
        if (!isPlainObject(contentItem)) {
          continue;
        }

        if (typeof contentItem.text === 'string') {
          parts.push(contentItem.text);
        }
      }
    }

    return parts.join('\n').trim();
  }

  return '';
}

function buildApiErrorMessage(status: number, responseBody: unknown): string {
  const message = extractApiErrorMessage(responseBody);

  if (message) {
    return `OpenAI API request failed with status ${status}: ${message}`;
  }

  return `OpenAI API request failed with status ${status}.`;
}

function extractApiErrorMessage(responseBody: unknown): string | undefined {
  if (!isPlainObject(responseBody)) {
    return undefined;
  }

  const directMessage = asNonEmptyString(responseBody.message);

  if (directMessage) {
    return directMessage;
  }

  if (isPlainObject(responseBody.error)) {
    return asNonEmptyString(responseBody.error.message);
  }

  return undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
