import { describe, expect, it } from 'vitest';

import { formatDeterministicSummaryComment } from '../../../src/review/formatSummary';
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

describe('formatDeterministicSummaryComment', () => {
  it('includes the fixed marker and deterministic pre-llm wording', () => {
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
    expect(body).toContain('This is a deterministic pre-LLM summary.');
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

  it('reports deterministic review context status without any llm findings', () => {
    const filteredFiles = filterPullRequestFiles(
      [createTextPatchFile('src/feature.ts', '@@ -1 +1 @@\n-old\n+new')],
      { maxPatchCharacters: 20 }
    );

    const body = formatDeterministicSummaryComment({
      metadata: createMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      reviewContext: createReviewContextMetadataFixture()
    });

    expect(body).toContain('This is a deterministic pre-LLM summary.');
    expect(body).toContain('Context status:');
    expect(body).toContain('- full file context mode: patch_only');
    expect(body).toContain('- full file context reason: no_reader');
    expect(body).not.toContain('LLM findings');
  });
});
