import { describe, expect, it } from 'vitest';

import {
  cleanJsonResponse,
  parseReviewJson
} from '../../../src/review/reviewSchema';

describe('cleanJsonResponse', () => {
  it('returns plain JSON unchanged aside from trimming', () => {
    expect(cleanJsonResponse('  {"summary":"ok","findings":[]}  ')).toBe(
      '{"summary":"ok","findings":[]}'
    );
  });

  it('strips markdown json code fences', () => {
    expect(
      cleanJsonResponse('```json\n{"summary":"ok","findings":[]}\n```')
    ).toBe('{"summary":"ok","findings":[]}');
  });
});

describe('parseReviewJson', () => {
  it('parses valid JSON into a stable review result', () => {
    const result = parseReviewJson(
      JSON.stringify({
        summary: 'Found one issue.',
        findings: [
          {
            file: 'src/example.ts',
            severity: 'high',
            confidence: 0.9,
            message: 'Potential null access.'
          }
        ],
        test_suggestions: ['Add a null-path unit test.'],
        truncation_notes: ['Patch was truncated.']
      })
    );

    expect(result).toEqual({
      summary: 'Found one issue.',
      findings: [
        {
          file: 'src/example.ts',
          severity: 'high',
          confidence: 0.9,
          message: 'Potential null access.'
        }
      ],
      test_suggestions: ['Add a null-path unit test.'],
      truncation_notes: ['Patch was truncated.']
    });
  });

  it('parses code-fenced JSON', () => {
    const result = parseReviewJson(
      '```json\n{"summary":"Looks good.","findings":[]}\n```'
    );

    expect(result).toEqual({
      summary: 'Looks good.',
      findings: []
    });
  });

  it('degrades malformed JSON into a raw-text result', () => {
    const result = parseReviewJson('Summary line\n\n{not-json');

    expect(result.findings).toEqual([]);
    expect(result.raw_text).toBe('Summary line\n\n{not-json');
    expect(result.summary).toContain('Summary line');
  });

  it('normalizes invalid severity values to medium', () => {
    const result = parseReviewJson(
      JSON.stringify({
        summary: 'One finding.',
        findings: [
          {
            file: 'src/example.ts',
            severity: 'urgent',
            confidence: 0.5,
            message: 'Unexpected behavior.'
          }
        ]
      })
    );

    expect(result.findings).toEqual([
      {
        file: 'src/example.ts',
        severity: 'medium',
        confidence: 0.5,
        message: 'Unexpected behavior.'
      }
    ]);
  });

  it('clamps confidence into the 0 to 1 range', () => {
    const result = parseReviewJson(
      JSON.stringify({
        summary: 'Confidence check.',
        findings: [
          {
            file: 'src/high.ts',
            severity: 'low',
            confidence: 4,
            message: 'Too high.'
          },
          {
            file: 'src/low.ts',
            severity: 'low',
            confidence: -2,
            message: 'Too low.'
          }
        ]
      })
    );

    expect(result.findings).toEqual([
      {
        file: 'src/high.ts',
        severity: 'low',
        confidence: 1,
        message: 'Too high.'
      },
      {
        file: 'src/low.ts',
        severity: 'low',
        confidence: 0,
        message: 'Too low.'
      }
    ]);
  });

  it('filters findings missing file or message', () => {
    const result = parseReviewJson(
      JSON.stringify({
        summary: 'Filter invalid findings.',
        findings: [
          {
            file: 'src/valid.ts',
            severity: 'medium',
            confidence: 0.8,
            message: 'Keep this finding.'
          },
          {
            severity: 'medium',
            confidence: 0.8,
            message: 'Missing file.'
          },
          {
            file: 'src/missing-message.ts',
            severity: 'medium',
            confidence: 0.8
          }
        ]
      })
    );

    expect(result.findings).toEqual([
      {
        file: 'src/valid.ts',
        severity: 'medium',
        confidence: 0.8,
        message: 'Keep this finding.'
      }
    ]);
  });
});
