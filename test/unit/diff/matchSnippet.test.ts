import { describe, expect, it } from 'vitest';

import { matchCandidateInlineFindings } from '../../../src/diff/matchSnippet';
import {
  createDeletedLineOnlyPatchFile,
  createFeaturePatchFile,
  createSecondFeaturePatchFile
} from '../../fixtures/patches';

describe('matchCandidateInlineFindings', () => {
  it('returns GitHub-ready path and line metadata for exact added-line matches', () => {
    const result = matchCandidateInlineFindings({
      inlineFindings: [
        {
          title: 'The increment logic should guard overflow.',
          severity: 'medium',
          confidence: 0.91,
          file: 'src/feature.ts',
          codeSnippet: 'const nextCount = count + 1;'
        }
      ],
      patches: [createFeaturePatchFile()],
      confidenceThreshold: 0.75,
      maxInlineComments: 5
    });

    expect(result.validatedInlineFindings).toEqual([
      {
        title: 'The increment logic should guard overflow.',
        severity: 'medium',
        confidence: 0.91,
        file: 'src/feature.ts',
        codeSnippet: 'const nextCount = count + 1;',
        path: 'src/feature.ts',
        line: 11
      }
    ]);
    expect(result.downgradedFindings).toEqual([]);
  });

  it('downgrades findings when the snippet does not match any added line', () => {
    const result = matchCandidateInlineFindings({
      inlineFindings: [
        {
          title: 'This line should not validate.',
          severity: 'low',
          confidence: 0.85,
          file: 'src/feature.ts',
          codeSnippet: 'const unmatched = true;'
        }
      ],
      patches: [createFeaturePatchFile()],
      confidenceThreshold: 0.75,
      maxInlineComments: 5
    });

    expect(result.validatedInlineFindings).toEqual([]);
    expect(result.downgradedFindings).toEqual([
      expect.objectContaining({
        title: 'This line should not validate.',
        file: 'src/feature.ts',
        reason: 'no_match'
      })
    ]);
  });

  it('downgrades findings when the target file patch is missing', () => {
    const result = matchCandidateInlineFindings({
      inlineFindings: [
        {
          title: 'This file is not in the reviewable patch set.',
          severity: 'medium',
          confidence: 0.8,
          file: 'src/missing.ts',
          codeSnippet: 'const nextCount = count + 1;'
        }
      ],
      patches: [createFeaturePatchFile()],
      confidenceThreshold: 0.75,
      maxInlineComments: 5
    });

    expect(result.validatedInlineFindings).toEqual([]);
    expect(result.downgradedFindings).toEqual([
      expect.objectContaining({
        title: 'This file is not in the reviewable patch set.',
        file: 'src/missing.ts',
        reason: 'wrong_file'
      })
    ]);
  });

  it('downgrades findings below the confidence threshold before snippet matching', () => {
    const result = matchCandidateInlineFindings({
      inlineFindings: [
        {
          title: 'Low confidence findings should stay in the summary.',
          severity: 'low',
          confidence: 0.74,
          file: 'src/feature.ts',
          codeSnippet: 'const nextCount = count + 1;'
        }
      ],
      patches: [createFeaturePatchFile()],
      confidenceThreshold: 0.75,
      maxInlineComments: 5
    });

    expect(result.validatedInlineFindings).toEqual([]);
    expect(result.downgradedFindings).toEqual([
      expect.objectContaining({
        title: 'Low confidence findings should stay in the summary.',
        reason: 'low_confidence'
      })
    ]);
  });

  it('downgrades validated candidates that exceed the max inline comment limit', () => {
    const result = matchCandidateInlineFindings({
      inlineFindings: [
        {
          title: 'First validated inline finding.',
          severity: 'high',
          confidence: 0.9,
          file: 'src/feature.ts',
          codeSnippet: 'const nextCount = count + 1;'
        },
        {
          title: 'Second validated inline finding should downgrade.',
          severity: 'medium',
          confidence: 0.82,
          file: 'src/second.ts',
          codeSnippet: 'const status = "ready";'
        }
      ],
      patches: [createFeaturePatchFile(), createSecondFeaturePatchFile()],
      confidenceThreshold: 0.75,
      maxInlineComments: 1
    });

    expect(result.validatedInlineFindings).toEqual([
      expect.objectContaining({
        title: 'First validated inline finding.',
        path: 'src/feature.ts',
        line: 11
      })
    ]);
    expect(result.downgradedFindings).toEqual([
      expect.objectContaining({
        title: 'Second validated inline finding should downgrade.',
        file: 'src/second.ts',
        reason: 'max_inline_comments'
      })
    ]);
  });

  it('does not validate snippets that only appear in deleted or context lines', () => {
    const result = matchCandidateInlineFindings({
      inlineFindings: [
        {
          title: 'Deleted lines are not inline eligible.',
          severity: 'medium',
          confidence: 0.81,
          file: 'src/deleted-only.ts',
          codeSnippet: 'const removedValue = computeOldValue();'
        },
        {
          title: 'Context lines are not inline eligible.',
          severity: 'medium',
          confidence: 0.81,
          file: 'src/feature.ts',
          codeSnippet: 'return nextCount;'
        }
      ],
      patches: [createDeletedLineOnlyPatchFile(), createFeaturePatchFile()],
      confidenceThreshold: 0.75,
      maxInlineComments: 5
    });

    expect(result.validatedInlineFindings).toEqual([]);
    expect(result.downgradedFindings).toEqual([
      expect.objectContaining({
        title: 'Deleted lines are not inline eligible.',
        reason: 'non_added_line_match'
      }),
      expect.objectContaining({
        title: 'Context lines are not inline eligible.',
        reason: 'non_added_line_match'
      })
    ]);
  });
});
