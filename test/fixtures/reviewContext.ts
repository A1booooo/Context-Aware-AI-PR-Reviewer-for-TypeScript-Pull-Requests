import type { ReviewerConfig } from '../../src/config/schema';
import type { IncludedDiffFile, ExcludedDiffFile } from '../../src/diff/filterFiles';
import type {
  PullRequestFileContentReader,
  PullRequestMetadata
} from '../../src/github/pr';

import {
  createDeletedFile,
  createMissingPatchFile,
  createTextPatchFile
} from './diffFiles';
import { filterPullRequestFiles } from '../../src/diff/filterFiles';

export function createReviewContextMetadataFixture(): PullRequestMetadata {
  return {
    owner: 'octo-org',
    repo: 'review-repo',
    pullNumber: 42,
    title: 'Improve review context assembly',
    body: 'This updates the deterministic review context builder.',
    author: 'contributor',
    base: {
      ref: 'main',
      sha: 'base-sha'
    },
    head: {
      ref: 'feature/task-6',
      sha: 'head-sha'
    }
  };
}

export function createReviewerConfigFixture(
  overrides: Partial<ReviewerConfig> = {}
): ReviewerConfig {
  return {
    language: 'zh-CN',
    max_files: 20,
    max_patch_chars_per_file: 6000,
    include_full_file_context: false,
    exclude: [],
    review: {
      severity_threshold: 'medium',
      max_inline_comments: 5,
      confidence_threshold: 0.75,
      focus: ['bug-risk', 'react-hooks']
    },
    ...overrides
  };
}

export function createFilteredReviewFilesFixture(): {
  includedFiles: IncludedDiffFile[];
  excludedFiles: ExcludedDiffFile[];
} {
  return filterPullRequestFiles([
    createTextPatchFile('src/feature.ts', '@@ -1 +1 @@\n-old\n+new'),
    createTextPatchFile('src/component.tsx', '@@ -1 +1 @@\n-old\n+new'),
    createMissingPatchFile('assets/diagram.png'),
    createDeletedFile('src/obsolete.ts')
  ]);
}

export function createLargeFilteredReviewFilesFixture(): {
  includedFiles: IncludedDiffFile[];
  excludedFiles: ExcludedDiffFile[];
} {
  return filterPullRequestFiles(
    Array.from({ length: 6 }, (_, index) =>
      createTextPatchFile(
        `src/file-${index + 1}.ts`,
        `@@ -1 +1 @@\n-old-${index + 1}\n+new-${index + 1}`
      )
    )
  );
}

export function createReaderFixture(
  contentsByFile: Record<string, string>
): PullRequestFileContentReader {
  return {
    readFile: async ({ path }) => {
      const content = contentsByFile[path];

      if (content === undefined) {
        return null;
      }

      return {
        path,
        content
      };
    }
  };
}
