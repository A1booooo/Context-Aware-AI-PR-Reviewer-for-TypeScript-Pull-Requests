import { createLogger, type Logger } from './utils/logger';
import { getErrorMessage } from './utils/errors';
import type { PullRequestContext } from './github/pr';
import {
  createGitHubCommentsClientFromEnvironment,
  type GitHubCommentsClient
} from './github/comments';
import { buildReviewContext } from './context/buildReviewContext';
import {
  filterPullRequestFiles,
  type IncludedDiffFile
} from './diff/filterFiles';
import {
  matchCandidateInlineFindings,
  type DowngradedInlineFinding,
  type ValidatedInlineFinding
} from './diff/matchSnippet';
import { publishDeterministicSummary } from './review/publishSummary';
import { publishValidatedInlineComments } from './review/publishInline';
import {
  createOpenAiReviewClientFromEnvironment,
  type LlmReviewClient,
  type StructuredReviewResult
} from './llm/client';
import { parseStructuredReview } from './llm/parseReview';
import {
  loadReviewerConfig
} from './config/loadConfig';
import type { ReviewerConfig } from './config/schema';
import type { SummaryAiReview } from './review/formatSummary';

export interface RunOptions {
  logger?: Logger;
  startup?: () => Promise<PullRequestContext | void>;
  createCommentsClient?: () => GitHubCommentsClient | null;
  createLlmClient?: () => LlmReviewClient;
  loadConfig?: () => ReviewerConfig;
}

export interface RunDeterministicSummaryWorkflowOptions {
  logger?: Logger;
  pullRequestContext: PullRequestContext;
  commentsClient: GitHubCommentsClient;
  llmClient: LlmReviewClient;
  config: ReviewerConfig;
}

async function defaultStartup(): Promise<void> {
  return Promise.resolve();
}

export async function runDeterministicSummaryWorkflow(
  options: RunDeterministicSummaryWorkflowOptions
) {
  const logger = options.logger ?? createLogger();
  const filteredFiles = filterPullRequestFiles(options.pullRequestContext.files, {
    excludePatterns: options.config.exclude,
    maxPatchCharacters: options.config.max_patch_chars_per_file,
    maxIncludedFiles: options.config.max_files
  });
  const reviewContext = await buildReviewContext({
    metadata: options.pullRequestContext.metadata,
    includedFiles: filteredFiles.includedFiles,
    excludedFiles: filteredFiles.excludedFiles,
    config: options.config
  });
  const aiReview = await buildSummaryAiReview({
    llmClient: options.llmClient,
    reviewContext,
    includedFiles: filteredFiles.includedFiles,
    config: options.config
  });
  const inlinePublishResult = await publishValidatedInlineComments({
    metadata: options.pullRequestContext.metadata,
    findings: aiReview.validatedInlineFindings,
    client: options.commentsClient
  });
  const result = await publishDeterministicSummary({
    metadata: options.pullRequestContext.metadata,
    includedFiles: filteredFiles.includedFiles,
    excludedFiles: filteredFiles.excludedFiles,
    reviewContext: reviewContext.metadata,
    aiReview: aiReview.summary,
    downgradedInlineFindings: [
      ...aiReview.downgradedInlineFindings,
      ...inlinePublishResult.downgradedFindings
    ],
    client: options.commentsClient
  });

  logger.info(
    `Summary review comment ${result.action} for PR #${options.pullRequestContext.metadata.pullNumber}.`
  );

  return result;
}

export async function run(options: RunOptions = {}): Promise<void> {
  const logger = options.logger ?? createLogger();
  const startup = options.startup ?? defaultStartup;
  const createCommentsClient =
    options.createCommentsClient ?? createGitHubCommentsClientFromEnvironment;
  const createLlmClient =
    options.createLlmClient ?? createOpenAiReviewClientFromEnvironment;
  const getReviewerConfig = options.loadConfig ?? loadReviewerConfig;

  logger.info('Action starting.');

  try {
    const config = getReviewerConfig();
    const pullRequestContext = await startup();

    if (pullRequestContext) {
      const commentsClient = createCommentsClient();

      if (commentsClient) {
        await runDeterministicSummaryWorkflow({
          logger,
          pullRequestContext,
          commentsClient,
          llmClient: createLlmClient(),
          config
        });
      } else {
        logger.info(
          'Skipping deterministic summary publish because GITHUB_TOKEN is not configured.'
        );
      }
    }

    logger.info('Action finished successfully.');
  } catch (error) {
    logger.error(`Action failed: ${getErrorMessage(error)}`);
    throw error;
  }
}

if (require.main === module) {
  run().catch(() => {
    process.exitCode = 1;
  });
}

async function buildSummaryAiReview(options: {
  llmClient: LlmReviewClient;
  reviewContext: Awaited<ReturnType<typeof buildReviewContext>>;
  includedFiles: IncludedDiffFile[];
  config: ReviewerConfig;
}): Promise<{
  summary: SummaryAiReview;
  validatedInlineFindings: ValidatedInlineFinding[];
  downgradedInlineFindings: DowngradedInlineFinding[];
}> {
  const llmResult = await options.llmClient.requestStructuredReview({
    reviewContext: options.reviewContext
  });

  if (llmResult.status === 'success') {
    return parseSummaryAiReview(llmResult, {
      includedFiles: options.includedFiles,
      config: options.config
    });
  }

  if (llmResult.status === 'skipped') {
    return {
      summary: {
        status: 'skipped',
        code: llmResult.code,
        message: llmResult.message
      },
      validatedInlineFindings: [],
      downgradedInlineFindings: []
    };
  }

  return {
    summary: {
      status: 'degraded',
      code: llmResult.code,
      message: llmResult.message
    },
    validatedInlineFindings: [],
    downgradedInlineFindings: []
  };
}

function parseSummaryAiReview(
  llmResult: Extract<StructuredReviewResult, { status: 'success' }>,
  options: {
    includedFiles: IncludedDiffFile[];
    config: ReviewerConfig;
  }
): {
  summary: SummaryAiReview;
  validatedInlineFindings: ValidatedInlineFinding[];
  downgradedInlineFindings: DowngradedInlineFinding[];
} {
  const parsedReview = parseStructuredReview(llmResult.outputText);

  if (!parsedReview.ok) {
    return {
      summary: {
        status: 'degraded',
        code: parsedReview.error.code,
        message:
          'AI review degraded because the provider returned malformed structured JSON. Raw model output was discarded.'
      },
      validatedInlineFindings: [],
      downgradedInlineFindings: []
    };
  }

  const matchedInlineFindings = matchCandidateInlineFindings({
    inlineFindings: parsedReview.inlineFindings,
    patches: options.includedFiles,
    confidenceThreshold: options.config.review.confidence_threshold,
    maxInlineComments: options.config.review.max_inline_comments
  });

  return {
    summary: {
      status: 'completed',
      findings: parsedReview.summaryFindings
    },
    validatedInlineFindings: matchedInlineFindings.validatedInlineFindings,
    downgradedInlineFindings: matchedInlineFindings.downgradedFindings
  };
}
