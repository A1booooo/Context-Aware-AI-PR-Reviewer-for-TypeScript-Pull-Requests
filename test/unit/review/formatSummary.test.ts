import { describe, expect, it } from 'vitest';

import {
  formatDeterministicSummaryComment,
  type SummaryAiReview
} from '../../../src/review/formatSummary';
import type { ReviewContextMetadata } from '../../../src/context/buildReviewContext';
import type { PullRequestMetadata } from '../../../src/github/pr';
import {
  createDeletedFile,
  createMissingPatchFile,
  createTextPatchFile
} from '../../fixtures/diffFiles';
import { filterPullRequestFiles } from '../../../src/diff/filterFiles';

function createMetadataFixture(): PullRequestMetadata {
  return {
    owner: 'octo-org',
    repo: 'review-repo',
    pullNumber: 42,
    title: 'Improve file loading',
    body: 'This updates the file collection flow.',
    author: 'contributor',
    base: {
      ref: 'main',
      sha: 'base-sha'
    },
    head: {
      ref: 'feature/task-4',
      sha: 'head-sha'
    }
  };
}

function createReviewContextMetadataFixture(): ReviewContextMetadata {
  return {
    includedFilesCount: 2,
    excludedFilesCount: 2,
    truncatedFilesCount: 1,
    truncatedFiles: ['src/truncated.ts'],
    totalPatchCharacters: 42,
    fullFileContext: {
      requested: true,
      mode: 'patch_only',
      reason: 'no_reader',
      includedFilesCount: 0
    },
    notes: ['Full file context fallback: no full file reader was provided.']
  };
}

function createCompletedAiReviewFixture(): SummaryAiReview {
  return {
    status: 'completed',
    findings: [
      {
        title: 'Missing null guard before property access',
        severity: 'high',
        confidence: 0.92,
        description:
          'The code reads user.profile.name before confirming profile exists.'
      },
      {
        title: 'Unbounded retry loop can duplicate requests',
        severity: 'critical',
        confidence: 0.88
      }
    ]
  };
}

describe('formatDeterministicSummaryComment', () => {
  it('includes the fixed marker and summary-only ai wording', () => {
    const patch = ['@@ -1,4 +1,4 @@', '-old line', '+new line', '+another line'].join('\n');
    const filteredFiles = filterPullRequestFiles(
      [
        createTextPatchFile('src/feature.ts', '@@ -1 +1 @@\n-old\n+new'),
        createTextPatchFile('src/large.ts', patch),
        createMissingPatchFile('assets/image.png'),
        createDeletedFile('src/obsolete.ts')
      ],
      { maxPatchCharacters: 20 }
    );

    const body = formatDeterministicSummaryComment({
      metadata: createMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles
    });

    expect(body).toContain('<!-- ai-pr-review-assistant -->');
    expect(body).toContain(
      'This summary publishes validated AI findings when available.'
    );
    expect(body).toContain('PR: #42 Improve file loading');
    expect(body).toContain('Changed files count: 4');
    expect(body).toContain('Included files count: 2');
    expect(body).toContain('Excluded files count: 2');
  });

  it('shows included, excluded, and truncated summaries in the comment body', () => {
    const filteredFiles = filterPullRequestFiles(
      [
        createTextPatchFile('src/feature.ts', '@@ -1 +1 @@\n-old\n+new'),
        createTextPatchFile(
          'src/truncated.ts',
          ['@@ -1,4 +1,4 @@', '-old line', '+new line', '+another line'].join('\n')
        ),
        createMissingPatchFile('assets/image.png'),
        createDeletedFile('src/obsolete.ts'),
        createTextPatchFile('docs/usage.md', '@@ -1 +1 @@\n-old\n+new')
      ],
      { maxPatchCharacters: 20 }
    );

    const body = formatDeterministicSummaryComment({
      metadata: createMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles
    });

    expect(body).toContain('Excluded reason summary:');
    expect(body).toContain('- deleted: 1');
    expect(body).toContain('- docs_only: 1');
    expect(body).toContain('- missing_patch: 1');
    expect(body).toContain('Truncated files summary:');
    expect(body).toContain('- src/truncated.ts');
    expect(body).toContain('Included file summary:');
    expect(body).toContain('- src/feature.ts');
  });

  it('reports review context status and validated ai findings without inline details', () => {
    const filteredFiles = filterPullRequestFiles(
      [createTextPatchFile('src/feature.ts', '@@ -1 +1 @@\n-old\n+new')],
      { maxPatchCharacters: 20 }
    );

    const body = formatDeterministicSummaryComment({
      metadata: createMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      reviewContext: createReviewContextMetadataFixture(),
      aiReview: createCompletedAiReviewFixture()
    });

    expect(body).toContain(
      'This summary publishes validated AI findings when available.'
    );
    expect(body).toContain('Context status:');
    expect(body).toContain('- full file context mode: patch_only');
    expect(body).toContain('- full file context reason: no_reader');
    expect(body).toContain('AI review status:');
    expect(body).toContain('- status: completed');
    expect(body).toContain('- validated summary findings count: 2');
    expect(body).toContain(
      '[critical] Unbounded retry loop can duplicate requests (confidence 0.88)'
    );
    expect(body).toContain(
      '[high] Missing null guard before property access (confidence 0.92)'
    );
    expect(body).toContain(
      'The code reads user.profile.name before confirming profile exists.'
    );
  });

  it('shows safe degradation details without publishing raw model output', () => {
    const filteredFiles = filterPullRequestFiles(
      [createTextPatchFile('src/feature.ts', '@@ -1 +1 @@\n-old\n+new')],
      { maxPatchCharacters: 20 }
    );

    const body = formatDeterministicSummaryComment({
      metadata: createMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      aiReview: {
        status: 'degraded',
        code: 'parse_error',
        message:
          'AI review degraded because the provider returned malformed structured JSON. Raw model output was discarded.'
      }
    });

    expect(body).toContain('AI review status:');
    expect(body).toContain('- status: degraded');
    expect(body).toContain('- reason: parse_error');
    expect(body).toContain(
      'AI review degraded because the provider returned malformed structured JSON. Raw model output was discarded.'
    );
    expect(body).toContain('Validated AI findings:\n- none');
    expect(body).not.toContain('Authorization: Bearer');
  });
});
