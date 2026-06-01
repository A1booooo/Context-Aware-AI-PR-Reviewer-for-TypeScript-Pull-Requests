import { createLogger, type Logger } from './utils/logger';
import { getErrorMessage } from './utils/errors';
import type { PullRequestContext } from './github/pr';

export interface RunOptions {
  logger?: Logger;
  startup?: () => Promise<PullRequestContext | void>;
}

async function defaultStartup(): Promise<void> {
  return Promise.resolve();
}

export async function run(options: RunOptions = {}): Promise<void> {
  const logger = options.logger ?? createLogger();
  const startup = options.startup ?? defaultStartup;

  logger.info('Action starting.');

  try {
    await startup();
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
