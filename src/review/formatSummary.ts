import type { ExcludedDiffFile, IncludedDiffFile } from '../diff/filterFiles';
import type { PullRequestMetadata } from '../github/pr';
import type { ReviewContextMetadata } from '../context/buildReviewContext';

export const DETERMINISTIC_SUMMARY_MARKER = '<!-- ai-pr-review-assistant -->';

const EXCLUDED_REASON_ORDER = [
  'deleted',
  'missing_patch',
  'generated',
  'lock_file',
  'minified',
  'docs_only'
] as const;

export interface FormatDeterministicSummaryCommentOptions {
  metadata: PullRequestMetadata;
  includedFiles: IncludedDiffFile[];
  excludedFiles: ExcludedDiffFile[];
  reviewContext?: ReviewContextMetadata;
}

export function formatDeterministicSummaryComment(
  options: FormatDeterministicSummaryCommentOptions
): string {
  const changedFilesCount =
    options.includedFiles.length + options.excludedFiles.length;
  const excludedReasonSummary = summarizeExcludedReasons(options.excludedFiles);
  const truncatedFiles = options.includedFiles
    .filter((file) => file.wasTruncated)
    .sort((left, right) => left.filename.localeCompare(right.filename));
  const includedFiles = [...options.includedFiles].sort((left, right) =>
    left.filename.localeCompare(right.filename)
  );

  const lines = [
    DETERMINISTIC_SUMMARY_MARKER,
    '## PR Summary',
    'This is a deterministic pre-LLM summary. It does not include AI review findings.',
    '',
    `PR: #${options.metadata.pullNumber} ${options.metadata.title}`,
    `Changed files count: ${changedFilesCount}`,
    `Included files count: ${options.includedFiles.length}`,
    `Excluded files count: ${options.excludedFiles.length}`,
    '',
    'Included file summary:'
  ];

  if (includedFiles.length === 0) {
    lines.push('- none');
  } else {
    for (const file of includedFiles) {
      lines.push(`- ${file.filename}`);
    }
  }

  lines.push('', 'Excluded reason summary:');

  if (excludedReasonSummary.length === 0) {
    lines.push('- none');
  } else {
    for (const summaryLine of excludedReasonSummary) {
      lines.push(summaryLine);
    }
  }

  lines.push('', 'Truncated files summary:');

  if (truncatedFiles.length === 0) {
    lines.push('- none');
  } else {
    for (const file of truncatedFiles) {
      lines.push(
        `- ${file.filename} (${file.truncatedPatchLength}/${file.originalPatchLength} chars kept)`
      );
    }
  }

  lines.push('', 'Context status:');

  if (!options.reviewContext) {
    lines.push('- not built');
  } else {
    lines.push(`- full file context mode: ${options.reviewContext.fullFileContext.mode}`);
    lines.push(`- full file context reason: ${options.reviewContext.fullFileContext.reason}`);
    lines.push(
      `- metadata notes count: ${options.reviewContext.notes.length}`
    );
  }

  return lines.join('\n');
}

function summarizeExcludedReasons(excludedFiles: ExcludedDiffFile[]): string[] {
  const counts = new Map<string, number>();

  for (const file of excludedFiles) {
    counts.set(file.reason, (counts.get(file.reason) ?? 0) + 1);
  }

  return EXCLUDED_REASON_ORDER.filter((reason) => counts.has(reason)).map(
    (reason) => `- ${reason}: ${counts.get(reason)}`
  );
}
