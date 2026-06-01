import type { PullRequestChangedFile, PullRequestTextPatchFile } from '../github/pr';

import {
  DEFAULT_MAX_PATCH_CHARACTERS,
  truncatePatch
} from './truncatePatch';

export const DEFAULT_DOCS_ONLY_EXTENSIONS = ['.md', '.mdx', '.txt'] as const;
export const DEFAULT_DOCS_ONLY_PATH_PREFIXES = ['docs/'] as const;
export const DEFAULT_GENERATED_PATH_PREFIXES = ['dist/', 'build/', 'coverage/'] as const;
export const DEFAULT_GENERATED_PATH_SEGMENTS = ['/generated/'] as const;
export const DEFAULT_GENERATED_FILE_SUFFIXES = [
  '.generated.ts',
  '.generated.tsx',
  '.generated.js',
  '.generated.jsx'
] as const;
export const DEFAULT_LOCK_FILE_NAMES = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb'
] as const;
export const DEFAULT_MINIFIED_FILE_SUFFIXES = [
  '.min.js',
  '.min.css',
  '.min.mjs',
  '.min.cjs'
] as const;

export type ExcludedFileReason =
  | 'deleted'
  | 'missing_patch'
  | 'generated'
  | 'lock_file'
  | 'minified'
  | 'docs_only';

export interface IncludedDiffFile extends PullRequestTextPatchFile {
  wasTruncated: boolean;
  originalPatchLength: number;
  truncatedPatchLength: number;
}

export interface ExcludedDiffFile {
  filename: string;
  reason: ExcludedFileReason;
}

export interface FilterPullRequestFilesOptions {
  maxPatchCharacters?: number;
}

export interface FilterPullRequestFilesResult {
  includedFiles: IncludedDiffFile[];
  excludedFiles: ExcludedDiffFile[];
}

export const DEFAULT_DIFF_FILTER_RULES = {
  docsOnlyExtensions: DEFAULT_DOCS_ONLY_EXTENSIONS,
  docsOnlyPathPrefixes: DEFAULT_DOCS_ONLY_PATH_PREFIXES,
  generatedPathPrefixes: DEFAULT_GENERATED_PATH_PREFIXES,
  generatedPathSegments: DEFAULT_GENERATED_PATH_SEGMENTS,
  generatedFileSuffixes: DEFAULT_GENERATED_FILE_SUFFIXES,
  lockFileNames: DEFAULT_LOCK_FILE_NAMES,
  minifiedFileSuffixes: DEFAULT_MINIFIED_FILE_SUFFIXES,
  maxPatchCharacters: DEFAULT_MAX_PATCH_CHARACTERS
} as const;

export function filterPullRequestFiles(
  files: PullRequestChangedFile[],
  options: FilterPullRequestFilesOptions = {}
): FilterPullRequestFilesResult {
  const includedFiles: IncludedDiffFile[] = [];
  const excludedFiles: ExcludedDiffFile[] = [];
  const maxPatchCharacters =
    options.maxPatchCharacters ?? DEFAULT_DIFF_FILTER_RULES.maxPatchCharacters;

  for (const file of files) {
    const reason = getExclusionReason(file);

    if (reason) {
      excludedFiles.push({
        filename: file.filename,
        reason
      });
      continue;
    }

    if (file.kind !== 'text_patch') {
      continue;
    }

    const truncatedPatch = truncatePatch(file.patch, {
      maxCharacters: maxPatchCharacters
    });

    includedFiles.push({
      ...file,
      patch: truncatedPatch.patch,
      wasTruncated: truncatedPatch.wasTruncated,
      originalPatchLength: truncatedPatch.originalPatchLength,
      truncatedPatchLength: truncatedPatch.truncatedPatchLength
    });
  }

  return {
    includedFiles,
    excludedFiles
  };
}

function getExclusionReason(
  file: PullRequestChangedFile
): ExcludedFileReason | null {
  if (file.kind === 'deleted') {
    return 'deleted';
  }

  if (file.kind === 'missing_patch') {
    return 'missing_patch';
  }

  const normalizedPath = normalizePath(file.filename);

  if (isGeneratedFile(normalizedPath)) {
    return 'generated';
  }

  if (isLockFile(normalizedPath)) {
    return 'lock_file';
  }

  if (isMinifiedFile(normalizedPath)) {
    return 'minified';
  }

  if (isDocsOnlyFile(normalizedPath)) {
    return 'docs_only';
  }

  return null;
}

function normalizePath(filename: string): string {
  return filename.replace(/\\/g, '/').toLowerCase();
}

function isGeneratedFile(normalizedPath: string): boolean {
  return (
    DEFAULT_DIFF_FILTER_RULES.generatedPathPrefixes.some((prefix) =>
      normalizedPath.startsWith(prefix)
    ) ||
    DEFAULT_DIFF_FILTER_RULES.generatedPathSegments.some((segment) =>
      normalizedPath.includes(segment)
    ) ||
    DEFAULT_DIFF_FILTER_RULES.generatedFileSuffixes.some((suffix) =>
      normalizedPath.endsWith(suffix)
    )
  );
}

function isLockFile(normalizedPath: string): boolean {
  const filename = normalizedPath.split('/').at(-1) ?? normalizedPath;

  return DEFAULT_DIFF_FILTER_RULES.lockFileNames.some(
    (lockFileName) => lockFileName === filename
  );
}

function isMinifiedFile(normalizedPath: string): boolean {
  return DEFAULT_DIFF_FILTER_RULES.minifiedFileSuffixes.some((suffix) =>
    normalizedPath.endsWith(suffix)
  );
}

function isDocsOnlyFile(normalizedPath: string): boolean {
  return (
    DEFAULT_DIFF_FILTER_RULES.docsOnlyPathPrefixes.some((prefix) =>
      normalizedPath.startsWith(prefix)
    ) ||
    DEFAULT_DIFF_FILTER_RULES.docsOnlyExtensions.some((extension) =>
      normalizedPath.endsWith(extension)
    )
  );
}

export { DEFAULT_MAX_PATCH_CHARACTERS };
