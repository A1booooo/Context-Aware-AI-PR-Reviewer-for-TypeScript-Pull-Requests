import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_PATCH_CHARACTERS,
  filterPullRequestFiles
} from '../../../src/diff/filterFiles';
import {
  createDeletedFile,
  createMissingPatchFile,
  createTextPatchFile
} from '../../fixtures/diffFiles';

describe('filterPullRequestFiles', () => {
  it('excludes deleted files', () => {
    const result = filterPullRequestFiles([createDeletedFile('src/obsolete.ts')]);

    expect(result.includedFiles).toEqual([]);
    expect(result.excludedFiles).toEqual([
      {
        filename: 'src/obsolete.ts',
        reason: 'deleted'
      }
    ]);
  });

  it('excludes files without a usable patch', () => {
    const result = filterPullRequestFiles([createMissingPatchFile('src/image.png')]);

    expect(result.includedFiles).toEqual([]);
    expect(result.excludedFiles).toEqual([
      {
        filename: 'src/image.png',
        reason: 'missing_patch'
      }
    ]);
  });

  it('excludes lock files by path rule', () => {
    const result = filterPullRequestFiles([
      createTextPatchFile('package-lock.json', '@@ -1 +1 @@\n-old\n+new')
    ]);

    expect(result.includedFiles).toEqual([]);
    expect(result.excludedFiles).toEqual([
      {
        filename: 'package-lock.json',
        reason: 'lock_file'
      }
    ]);
  });

  it('excludes minified files by path rule', () => {
    const result = filterPullRequestFiles([
      createTextPatchFile('web/app.min.js', '@@ -1 +1 @@\n-old\n+new')
    ]);

    expect(result.includedFiles).toEqual([]);
    expect(result.excludedFiles).toEqual([
      {
        filename: 'web/app.min.js',
        reason: 'minified'
      }
    ]);
  });

  it('excludes generated files by path rule', () => {
    const result = filterPullRequestFiles([
      createTextPatchFile('src/api.generated.ts', '@@ -1 +1 @@\n-old\n+new')
    ]);

    expect(result.includedFiles).toEqual([]);
    expect(result.excludedFiles).toEqual([
      {
        filename: 'src/api.generated.ts',
        reason: 'generated'
      }
    ]);
  });

  it('excludes docs-only files by single-file path rule', () => {
    const result = filterPullRequestFiles([
      createTextPatchFile('docs/usage.md', '@@ -1 +1 @@\n-old\n+new'),
      createTextPatchFile('README.mdx', '@@ -1 +1 @@\n-old\n+new'),
      createTextPatchFile('notes/changelog.txt', '@@ -1 +1 @@\n-old\n+new')
    ]);

    expect(result.includedFiles).toEqual([]);
    expect(result.excludedFiles).toEqual([
      {
        filename: 'docs/usage.md',
        reason: 'docs_only'
      },
      {
        filename: 'README.mdx',
        reason: 'docs_only'
      },
      {
        filename: 'notes/changelog.txt',
        reason: 'docs_only'
      }
    ]);
  });

  it('truncates oversized patches for included files', () => {
    const patch = ['@@ -1,4 +1,4 @@', '-old line', '+new line', '+another line'].join('\n');

    const result = filterPullRequestFiles(
      [createTextPatchFile('src/feature.ts', patch)],
      { maxPatchCharacters: 20 }
    );

    expect(result.excludedFiles).toEqual([]);
    expect(result.includedFiles).toEqual([
      {
        filename: 'src/feature.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch: '@@ -1,4 +1,4 @@',
        wasTruncated: true,
        originalPatchLength: patch.length,
        truncatedPatchLength: '@@ -1,4 +1,4 @@'.length
      }
    ]);
  });

  it('keeps normal TypeScript files included with original patch metadata', () => {
    const patch = '@@ -1 +1 @@\n-old\n+new';

    const result = filterPullRequestFiles([
      createTextPatchFile('src/feature.ts', patch)
    ]);

    expect(result.excludedFiles).toEqual([]);
    expect(result.includedFiles).toEqual([
      {
        filename: 'src/feature.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch,
        wasTruncated: false,
        originalPatchLength: patch.length,
        truncatedPatchLength: patch.length
      }
    ]);
    expect(DEFAULT_MAX_PATCH_CHARACTERS).toBeGreaterThan(patch.length);
  });
});
