import type { ReviewerConfig } from '../config/schema';
import type { ExcludedDiffFile, IncludedDiffFile } from '../diff/filterFiles';
import type {
  PullRequestFileContentReader,
  PullRequestMetadata
} from '../github/pr';

export const DEFAULT_FULL_FILE_CONTEXT_SAFETY_LIMITS = {
  maxIncludedFiles: 5,
  maxTotalPatchCharacters: 12000
} as const;

const OUTPUT_SCHEMA_INSTRUCTIONS = [
  'Output requirements for a future reviewer:',
  '- Return deterministic JSON only.',
  '- Do not wrap JSON in markdown fences.',
  '- Do not invent files, code, or runtime behavior that is not present in the provided context.',
  '- If the context is insufficient for a claim, omit that claim instead of guessing.',
  '- Keep any file references aligned to the provided reviewable filenames.'
].join('\n');

type FullFileContextMode = 'full' | 'patch_only';
type FullFileContextReason =
  | 'included'
  | 'disabled_in_config'
  | 'no_reader'
  | 'pr_too_large'
  | 'read_failed';

export interface ReviewContext {
  metadata: ReviewContextMetadata;
  sections: ReviewContextSections;
}

export interface ReviewContextMetadata {
  includedFilesCount: number;
  excludedFilesCount: number;
  truncatedFilesCount: number;
  truncatedFiles: string[];
  totalPatchCharacters: number;
  fullFileContext: {
    requested: boolean;
    mode: FullFileContextMode;
    reason: FullFileContextReason;
    includedFilesCount: number;
  };
  notes: string[];
}

export interface ReviewContextSections {
  pullRequestMetadata: string;
  patchDiff: string;
  fullFileContext: string;
  reviewFocus: string;
  outputSchemaInstructions: string;
  metadataNotes: string;
}

export interface BuildReviewContextOptions {
  metadata: PullRequestMetadata;
  includedFiles: IncludedDiffFile[];
  excludedFiles: ExcludedDiffFile[];
  config: ReviewerConfig;
  fullFileReader?: PullRequestFileContentReader;
}

interface FullFileContextBuildResult {
  mode: FullFileContextMode;
  reason: FullFileContextReason;
  includedFilesCount: number;
  notes: string[];
  section: string;
}

export async function buildReviewContext(
  options: BuildReviewContextOptions
): Promise<ReviewContext> {
  const truncatedFiles = options.includedFiles
    .filter((file) => file.wasTruncated)
    .map((file) => file.filename);
  const totalPatchCharacters = options.includedFiles.reduce(
    (sum, file) => sum + file.truncatedPatchLength,
    0
  );
  const fullFileContextResult = await buildFullFileContextSection(options);
  const notes = [
    ...buildPatchNotes(options.includedFiles),
    ...fullFileContextResult.notes
  ];

  return {
    metadata: {
      includedFilesCount: options.includedFiles.length,
      excludedFilesCount: options.excludedFiles.length,
      truncatedFilesCount: truncatedFiles.length,
      truncatedFiles,
      totalPatchCharacters,
      fullFileContext: {
        requested: options.config.include_full_file_context,
        mode: fullFileContextResult.mode,
        reason: fullFileContextResult.reason,
        includedFilesCount: fullFileContextResult.includedFilesCount
      },
      notes
    },
    sections: {
      pullRequestMetadata: buildPullRequestMetadataSection(options.metadata),
      patchDiff: buildPatchDiffSection(options.includedFiles),
      fullFileContext: fullFileContextResult.section,
      reviewFocus: buildReviewFocusSection(options.config),
      outputSchemaInstructions: OUTPUT_SCHEMA_INSTRUCTIONS,
      metadataNotes: buildMetadataNotesSection(notes)
    }
  };
}

async function buildFullFileContextSection(
  options: BuildReviewContextOptions
): Promise<FullFileContextBuildResult> {
  if (!options.config.include_full_file_context) {
    return createPatchOnlyFullFileContextResult(
      'disabled_in_config',
      'Full file context fallback: include_full_file_context is disabled in config.'
    );
  }

  if (!options.fullFileReader) {
    return createPatchOnlyFullFileContextResult(
      'no_reader',
      'Full file context fallback: no full file reader was provided.'
    );
  }

  const tooManyFiles =
    options.includedFiles.length >
    DEFAULT_FULL_FILE_CONTEXT_SAFETY_LIMITS.maxIncludedFiles;

  if (tooManyFiles) {
    return createPatchOnlyFullFileContextResult(
      'pr_too_large',
      `Full file context fallback: included files exceeded the explicit safety limit of ${DEFAULT_FULL_FILE_CONTEXT_SAFETY_LIMITS.maxIncludedFiles}.`
    );
  }

  const totalPatchCharacters = options.includedFiles.reduce(
    (sum, file) => sum + file.truncatedPatchLength,
    0
  );
  const tooManyPatchCharacters =
    totalPatchCharacters >
    DEFAULT_FULL_FILE_CONTEXT_SAFETY_LIMITS.maxTotalPatchCharacters;

  if (tooManyPatchCharacters) {
    return createPatchOnlyFullFileContextResult(
      'pr_too_large',
      `Full file context fallback: total included patch characters exceeded the explicit safety limit of ${DEFAULT_FULL_FILE_CONTEXT_SAFETY_LIMITS.maxTotalPatchCharacters}.`
    );
  }

  const lines = [
    `Full file context included for ${options.includedFiles.length} reviewable file(s).`
  ];

  for (const file of options.includedFiles) {
    try {
      const fileContent = await options.fullFileReader.readFile({
        owner: options.metadata.owner,
        repo: options.metadata.repo,
        ref: options.metadata.head.sha,
        path: file.filename
      });

      if (!fileContent || typeof fileContent.content !== 'string') {
        return createPatchOnlyFullFileContextResult(
          'read_failed',
          'Full file context fallback: one or more reviewable files could not be read safely.'
        );
      }

      lines.push('', `File: ${file.filename}`, fileContent.content);
    } catch {
      return createPatchOnlyFullFileContextResult(
        'read_failed',
        'Full file context fallback: one or more reviewable files could not be read safely.'
      );
    }
  }

  return {
    mode: 'full',
    reason: 'included',
    includedFilesCount: options.includedFiles.length,
    notes: ['Full file context included for all reviewable files.'],
    section: lines.join('\n')
  };
}

function createPatchOnlyFullFileContextResult(
  reason: Exclude<FullFileContextReason, 'included'>,
  note: string
): FullFileContextBuildResult {
  return {
    mode: 'patch_only',
    reason,
    includedFilesCount: 0,
    notes: [note],
    section: ['Full file context omitted.', `Patch-only fallback reason: ${reason}.`].join(
      '\n'
    )
  };
}

function buildPullRequestMetadataSection(metadata: PullRequestMetadata): string {
  return [
    `PR #${metadata.pullNumber}: ${metadata.title}`,
    `Repository: ${metadata.owner}/${metadata.repo}`,
    `Author: ${metadata.author}`,
    `Base: ${metadata.base.ref} (${metadata.base.sha})`,
    `Head: ${metadata.head.ref} (${metadata.head.sha})`,
    `Body: ${metadata.body || '(empty)'}`
  ].join('\n');
}

function buildPatchDiffSection(includedFiles: IncludedDiffFile[]): string {
  const lines = ['Reviewable patch diff:'];

  if (includedFiles.length === 0) {
    lines.push('- none');
    return lines.join('\n');
  }

  for (const file of includedFiles) {
    lines.push(
      '',
      `File: ${file.filename}`,
      `Patch chars kept: ${file.truncatedPatchLength}/${file.originalPatchLength}`,
      file.patch
    );
  }

  return lines.join('\n');
}

function buildReviewFocusSection(config: ReviewerConfig): string {
  return [
    `Configured review focus (preserve this order): ${config.review.focus.join(', ')}`,
    'TypeScript guidance: verify unsafe any usage, missing null handling, broken narrowing, and unsound API contracts.',
    'React guidance: verify hook dependencies, stale closures, render side effects, and state consistency across async flows.'
  ].join('\n');
}

function buildMetadataNotesSection(notes: string[]): string {
  if (notes.length === 0) {
    return 'No additional metadata notes.';
  }

  return ['Metadata and truncation notes:', ...notes.map((note) => `- ${note}`)].join(
    '\n'
  );
}

function buildPatchNotes(includedFiles: IncludedDiffFile[]): string[] {
  const truncatedFiles = includedFiles.filter((file) => file.wasTruncated);

  if (truncatedFiles.length === 0) {
    return ['No included patches required truncation.'];
  }

  return truncatedFiles.map(
    (file) =>
      `Patch truncation: ${file.filename} kept ${file.truncatedPatchLength}/${file.originalPatchLength} characters.`
  );
}
