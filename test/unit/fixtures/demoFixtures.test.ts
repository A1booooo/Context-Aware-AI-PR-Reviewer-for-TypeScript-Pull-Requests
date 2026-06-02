import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseStructuredReview } from '../../../src/llm/parseReview';

interface ExpectedFixturePayload {
  summary_findings?: Array<{
    title?: string;
  }>;
  inline_findings?: Array<{
    title?: string;
  }>;
}

const demoFixtures = [
  'pr-1-auth-bug',
  'pr-2-react-effect-bug',
  'pr-3-error-handling',
  'pr-4-token-storage'
] as const;

describe('demo review fixtures', () => {
  for (const fixtureName of demoFixtures) {
    it(`loads ${fixtureName} diff content`, () => {
      const diffContent = readFixtureFile(fixtureName, '.diff');

      expect(diffContent).toContain('diff --git');
      expect(diffContent.trim().length).toBeGreaterThan(0);
    });

    it(`parses ${fixtureName} expected findings through the current review parser`, () => {
      const rawExpectedJson = readFixtureFile(fixtureName, '.expected.json');
      const expectedPayload = JSON.parse(rawExpectedJson) as ExpectedFixturePayload;
      const parsedReview = parseStructuredReview(rawExpectedJson);

      expect(parsedReview.ok).toBe(true);

      if (!parsedReview.ok) {
        throw new Error(parsedReview.error.message);
      }

      const expectedSummaryTitles = (expectedPayload.summary_findings ?? []).map(
        (finding) => finding.title
      );
      const expectedInlineTitles = (expectedPayload.inline_findings ?? []).map(
        (finding) => finding.title
      );

      expect(parsedReview.summaryFindings).toHaveLength(expectedSummaryTitles.length);
      expect(parsedReview.inlineFindings).toHaveLength(expectedInlineTitles.length);
      expect(parsedReview.summaryFindings.map((finding) => finding.title)).toEqual(
        expectedSummaryTitles
      );
      expect(parsedReview.inlineFindings.map((finding) => finding.title)).toEqual(
        expectedInlineTitles
      );
    });
  }
});

function readFixtureFile(
  fixtureName: (typeof demoFixtures)[number],
  extension: '.diff' | '.expected.json'
): string {
  return readFileSync(
    path.join(process.cwd(), 'demo', 'fixtures', `${fixtureName}${extension}`),
    'utf8'
  );
}
