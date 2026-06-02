import type { ExcludedDiffFile, IncludedDiffFile } from '../diff/filterFiles';
import {
  type GitHubCommentsClient,
  upsertPullRequestCommentByMarker
} from '../github/comments';
import type { ReviewContextMetadata } from '../context/buildReviewContext';
import type { PullRequestMetadata } from '../github/pr';

import {
  DETERMINISTIC_SUMMARY_MARKER,
  formatDeterministicSummaryComment
} from './formatSummary';

export interface PublishDeterministicSummaryOptions {
  metadata: PullRequestMetadata;
  includedFiles: IncludedDiffFile[];
  excludedFiles: ExcludedDiffFile[];
  reviewContext?: ReviewContextMetadata;
  client: GitHubCommentsClient;
}

export async function publishDeterministicSummary(
  options: PublishDeterministicSummaryOptions
) {
  const body = formatDeterministicSummaryComment({
    metadata: options.metadata,
    includedFiles: options.includedFiles,
    excludedFiles: options.excludedFiles,
    reviewContext: options.reviewContext
  });

  return upsertPullRequestCommentByMarker({
    owner: options.metadata.owner,
    repo: options.metadata.repo,
    pullNumber: options.metadata.pullNumber,
    marker: DETERMINISTIC_SUMMARY_MARKER,
    body,
    client: options.client
  });
}
