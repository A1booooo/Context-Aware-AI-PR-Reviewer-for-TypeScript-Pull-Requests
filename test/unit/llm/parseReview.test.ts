import { describe, expect, it } from 'vitest';

import { parseStructuredReview } from '../../../src/llm/parseReview';
import {
  createCodeFencedReviewJsonOutput,
  createInlineDowngradeOutput,
  createInvalidConfidenceOutput,
  createInvalidSeverityOutput,
  createInvalidTopLevelOutput,
  createMalformedReviewJsonOutput,
  createMissingCoreFieldsOutput,
  createPlainCodeFencedReviewJsonOutput,
  createValidReviewJsonOutput
} from '../../fixtures/llmOutputs';

describe('parseStructuredReview', () => {
  it('parses valid JSON into typed summary and inline findings', () => {
    const result = parseStructuredReview(createValidReviewJsonOutput());

    expect(result).toEqual({
      ok: true,
      summaryFindings: [
        {
          title: 'Missing null guard before property access',
          severity: 'high',
          confidence: 0.92,
          description:
            'The code reads user.profile.name before confirming profile exists.'
        }
      ],
      inlineFindings: [
        {
          title: 'Effect depends on stale closure state',
          severity: 'medium',
          confidence: 0.81,
          file: 'src/component.tsx',
          codeSnippet: 'useEffect(() => syncCount(count), [])'
        }
      ]
    });
  });

  it('parses json wrapped in fenced code blocks', () => {
    expect(parseStructuredReview(createCodeFencedReviewJsonOutput())).toEqual(
      parseStructuredReview(createValidReviewJsonOutput())
    );
    expect(parseStructuredReview(createPlainCodeFencedReviewJsonOutput())).toEqual(
      parseStructuredReview(createValidReviewJsonOutput())
    );
  });

  it('returns a summary-safe parse error result for malformed json', () => {
    expect(() => parseStructuredReview(createMalformedReviewJsonOutput())).not.toThrow();
    expect(parseStructuredReview(createMalformedReviewJsonOutput())).toEqual({
      ok: false,
      error: {
        code: 'parse_error',
        message: 'Failed to parse structured review JSON.'
      },
      summaryFindings: [],
      inlineFindings: []
    });
  });

  it('returns a summary-safe parse error result for invalid top-level structures', () => {
    expect(parseStructuredReview(createInvalidTopLevelOutput())).toEqual({
      ok: false,
      error: {
        code: 'invalid_structure',
        message: 'Structured review output must be a JSON object.'
      },
      summaryFindings: [],
      inlineFindings: []
    });
  });

  it('excludes findings with invalid severity', () => {
    expect(parseStructuredReview(createInvalidSeverityOutput())).toEqual({
      ok: true,
      summaryFindings: [],
      inlineFindings: []
    });
  });

  it('excludes findings with invalid confidence', () => {
    expect(parseStructuredReview(createInvalidConfidenceOutput())).toEqual({
      ok: true,
      summaryFindings: [],
      inlineFindings: []
    });
  });

  it('downgrades inline findings when file or code snippet is invalid but core summary fields are valid', () => {
    expect(parseStructuredReview(createInlineDowngradeOutput())).toEqual({
      ok: true,
      summaryFindings: [
        {
          title: 'The finding can still appear in the summary.',
          severity: 'low',
          confidence: 0.6,
          description: 'The finding can still appear in the summary.'
        },
        {
          title: 'Missing file should also downgrade when core fields are valid.',
          severity: 'medium',
          confidence: 0.7
        }
      ],
      inlineFindings: []
    });
  });

  it('excludes findings that are missing core summary fields', () => {
    expect(parseStructuredReview(createMissingCoreFieldsOutput())).toEqual({
      ok: true,
      summaryFindings: [],
      inlineFindings: []
    });
  });
});
