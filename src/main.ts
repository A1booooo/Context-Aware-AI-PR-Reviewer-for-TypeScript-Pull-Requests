import { createLogger, type Logger } from './utils/logger';
import { getErrorMessage } from './utils/errors';
import type { PullRequestContext } from './github/pr';
import {
  createGitHubCommentsClientFromEnvironment,
  type GitHubCommentsClient
} from './github/comments';
import { buildReviewContext } from './context/buildReviewContext';
import { filterPullRequestFiles } from './diff/filterFiles';
import { publishDeterministicSummary } from './review/publishSummary';
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
    reviewContext
  });
  const result = await publishDeterministicSummary({
    metadata: options.pullRequestContext.metadata,
    includedFiles: filteredFiles.includedFiles,
    excludedFiles: filteredFiles.excludedFiles,
    reviewContext: reviewContext.metadata,
    aiReview,
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
}): Promise<SummaryAiReview> {
  const llmResult = await options.llmClient.requestStructuredReview({
    reviewContext: options.reviewContext
  });

  if (llmResult.status === 'success') {
    return parseSummaryAiReview(llmResult);
  }

  if (llmResult.status === 'skipped') {
    return {
      status: 'skipped',
      code: llmResult.code,
      message: llmResult.message
    };
  }

  return {
    status: 'degraded',
    code: llmResult.code,
    message: llmResult.message
  };
}

function parseSummaryAiReview(
  llmResult: Extract<StructuredReviewResult, { status: 'success' }>
): SummaryAiReview {
  const parsedReview = parseStructuredReview(llmResult.outputText);

  if (!parsedReview.ok) {
    return {
      status: 'degraded',
      code: parsedReview.error.code,
      message:
        'AI review degraded because the provider returned malformed structured JSON. Raw model output was discarded.'
    };
  }

  return {
    status: 'completed',
    findings: parsedReview.summaryFindings
  };
}
