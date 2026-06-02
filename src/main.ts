import { createLogger, type Logger } from './utils/logger';
import { getErrorMessage } from './utils/errors';
import type { PullRequestContext } from './github/pr';
import {
  createGitHubCommentsClientFromEnvironment,
  type GitHubCommentsClient
} from './github/comments';
import { filterPullRequestFiles } from './diff/filterFiles';
import { publishDeterministicSummary } from './review/publishSummary';

export interface RunOptions {
  logger?: Logger;
  startup?: () => Promise<PullRequestContext | void>;
  createCommentsClient?: () => GitHubCommentsClient | null;
}

export interface RunDeterministicSummaryWorkflowOptions {
  logger?: Logger;
  pullRequestContext: PullRequestContext;
  commentsClient: GitHubCommentsClient;
}

async function defaultStartup(): Promise<void> {
  return Promise.resolve();
}

export async function runDeterministicSummaryWorkflow(
  options: RunDeterministicSummaryWorkflowOptions
) {
  const logger = options.logger ?? createLogger();
  const filteredFiles = filterPullRequestFiles(options.pullRequestContext.files);
  const result = await publishDeterministicSummary({
    metadata: options.pullRequestContext.metadata,
    includedFiles: filteredFiles.includedFiles,
    excludedFiles: filteredFiles.excludedFiles,
    client: options.commentsClient
  });

  logger.info(
    `Deterministic pre-LLM summary comment ${result.action} for PR #${options.pullRequestContext.metadata.pullNumber}.`
  );

  return result;
}

export async function run(options: RunOptions = {}): Promise<void> {
  const logger = options.logger ?? createLogger();
  const startup = options.startup ?? defaultStartup;
  const createCommentsClient =
    options.createCommentsClient ?? createGitHubCommentsClientFromEnvironment;

  logger.info('Action starting.');

  try {
    const pullRequestContext = await startup();

    if (pullRequestContext) {
      const commentsClient = createCommentsClient();

      if (commentsClient) {
        await runDeterministicSummaryWorkflow({
          logger,
          pullRequestContext,
          commentsClient
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
