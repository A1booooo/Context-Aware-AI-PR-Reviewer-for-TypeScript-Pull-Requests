import { describe, expect, it, vi } from 'vitest';

import {
  buildReviewContext,
  DEFAULT_FULL_FILE_CONTEXT_SAFETY_LIMITS
} from '../../../src/context/buildReviewContext';
import {
  createFilteredReviewFilesFixture,
  createLargeFilteredReviewFilesFixture,
  createReaderFixture,
  createReviewerConfigFixture,
  createReviewContextMetadataFixture
} from '../../fixtures/reviewContext';

describe('buildReviewContext', () => {
  it('includes full file context for small prs when config enables it', async () => {
    const filteredFiles = createFilteredReviewFilesFixture();
    const reader = {
      readFile: vi.fn(
        createReaderFixture({
          'src/feature.ts': 'export const feature = true;\n',
          'src/component.tsx': 'export function Component() { return null; }\n'
        }).readFile
      )
    };

    const result = await buildReviewContext({
      metadata: createReviewContextMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      config: createReviewerConfigFixture({
        include_full_file_context: true
      }),
      fullFileReader: reader
    });

    expect(result.metadata.fullFileContext).toEqual({
      requested: true,
      mode: 'full',
      reason: 'included',
      includedFilesCount: 2
    });
    expect(result.sections.fullFileContext).toContain('Full file context included for 2 reviewable file(s).');
    expect(result.sections.fullFileContext).toContain('File: src/feature.ts');
    expect(result.sections.fullFileContext).toContain('export const feature = true;');
    expect(result.sections.fullFileContext).toContain('File: src/component.tsx');
    expect(reader.readFile).toHaveBeenCalledTimes(2);
    expect(reader.readFile).toHaveBeenNthCalledWith(1, {
      owner: 'octo-org',
      repo: 'review-repo',
      ref: 'head-sha',
      path: 'src/feature.ts'
    });
    expect(reader.readFile).toHaveBeenNthCalledWith(2, {
      owner: 'octo-org',
      repo: 'review-repo',
      ref: 'head-sha',
      path: 'src/component.tsx'
    });
  });

  it('falls back to patch-only context for large prs using explicit safety limits', async () => {
    const filteredFiles = createLargeFilteredReviewFilesFixture();
    const reader = {
      readFile: vi.fn()
    };

    const result = await buildReviewContext({
      metadata: createReviewContextMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      config: createReviewerConfigFixture({
        include_full_file_context: true
      }),
      fullFileReader: reader
    });

    expect(result.metadata.fullFileContext).toEqual({
      requested: true,
      mode: 'patch_only',
      reason: 'pr_too_large',
      includedFilesCount: 0
    });
    expect(result.metadata.notes).toContain(
      `Full file context fallback: included files exceeded the explicit safety limit of ${DEFAULT_FULL_FILE_CONTEXT_SAFETY_LIMITS.maxIncludedFiles}.`
    );
    expect(result.sections.fullFileContext).toContain('Patch-only fallback reason: pr_too_large.');
    expect(reader.readFile).not.toHaveBeenCalled();
  });

  it('falls back to patch-only context when full file context is disabled', async () => {
    const filteredFiles = createFilteredReviewFilesFixture();

    const result = await buildReviewContext({
      metadata: createReviewContextMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      config: createReviewerConfigFixture({
        include_full_file_context: false
      })
    });

    expect(result.metadata.fullFileContext).toEqual({
      requested: false,
      mode: 'patch_only',
      reason: 'disabled_in_config',
      includedFilesCount: 0
    });
    expect(result.sections.fullFileContext).toContain('Patch-only fallback reason: disabled_in_config.');
  });

  it('falls back to patch-only context when no full file reader is provided', async () => {
    const filteredFiles = createFilteredReviewFilesFixture();

    const result = await buildReviewContext({
      metadata: createReviewContextMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      config: createReviewerConfigFixture({
        include_full_file_context: true
      })
    });

    expect(result.metadata.fullFileContext).toEqual({
      requested: true,
      mode: 'patch_only',
      reason: 'no_reader',
      includedFilesCount: 0
    });
    expect(result.sections.fullFileContext).toContain('Patch-only fallback reason: no_reader.');
  });

  it('uses review focus from config while keeping deterministic typescript and react guidance', async () => {
    const filteredFiles = createFilteredReviewFilesFixture();

    const result = await buildReviewContext({
      metadata: createReviewContextMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      config: createReviewerConfigFixture({
        review: {
          severity_threshold: 'medium',
          max_inline_comments: 5,
          confidence_threshold: 0.75,
          focus: ['security', 'maintainability', 'react-hooks']
        }
      })
    });

    expect(result.sections.reviewFocus).toContain(
      'Configured review focus (preserve this order): security, maintainability, react-hooks'
    );
    expect(result.sections.reviewFocus).toContain(
      'TypeScript guidance: verify unsafe any usage, missing null handling, broken narrowing, and unsound API contracts.'
    );
    expect(result.sections.reviewFocus).toContain(
      'React guidance: verify hook dependencies, stale closures, render side effects, and state consistency across async flows.'
    );
  });

  it('includes stable output schema instructions text', async () => {
    const filteredFiles = createFilteredReviewFilesFixture();

    const result = await buildReviewContext({
      metadata: createReviewContextMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      config: createReviewerConfigFixture()
    });

    expect(result.sections.outputSchemaInstructions).toBe(
      [
        'Output requirements for a future reviewer:',
        '- Return deterministic JSON only.',
        '- Do not wrap JSON in markdown fences.',
        '- Do not invent files, code, or runtime behavior that is not present in the provided context.',
        '- If the context is insufficient for a claim, omit that claim instead of guessing.',
        '- Keep any file references aligned to the provided reviewable filenames.'
      ].join('\n')
    );
  });

  it('falls back to patch-only context when the file reader fails or cannot read a file', async () => {
    const filteredFiles = createFilteredReviewFilesFixture();
    const reader = {
      readFile: vi.fn(async ({ path }: { path: string }) => {
        if (path === 'src/component.tsx') {
          throw new Error('failed to read file');
        }

        return {
          path,
          content: 'export const feature = true;\n'
        };
      })
    };

    const result = await buildReviewContext({
      metadata: createReviewContextMetadataFixture(),
      includedFiles: filteredFiles.includedFiles,
      excludedFiles: filteredFiles.excludedFiles,
      config: createReviewerConfigFixture({
        include_full_file_context: true
      }),
      fullFileReader: reader
    });

    expect(result.metadata.fullFileContext).toEqual({
      requested: true,
      mode: 'patch_only',
      reason: 'read_failed',
      includedFilesCount: 0
    });
    expect(result.metadata.notes).toContain(
      'Full file context fallback: one or more reviewable files could not be read safely.'
    );
    expect(result.sections.fullFileContext).toContain('Patch-only fallback reason: read_failed.');
  });
});
