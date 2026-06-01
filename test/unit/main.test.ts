import { describe, expect, it, vi } from 'vitest';

import { run } from '../../src/main';
import { createLogger } from '../../src/utils/logger';

describe('run', () => {
  it('logs startup and completion for the minimal action flow', async () => {
    const info = vi.fn();
    const error = vi.fn();

    await run({
      logger: { info, error },
      startup: vi.fn(async () => undefined)
    });

    expect(info).toHaveBeenCalledWith('Action starting.');
    expect(info).toHaveBeenCalledWith('Action finished successfully.');
    expect(error).not.toHaveBeenCalled();
  });

  it('logs a safe error message and rethrows startup failures', async () => {
    const info = vi.fn();
    const error = vi.fn();

    await expect(
      run({
        logger: { info, error },
        startup: vi.fn(async () => {
          throw new Error('Authorization: Bearer super-secret-token');
        })
      })
    ).rejects.toThrow('Authorization: Bearer super-secret-token');

    expect(error).toHaveBeenCalledWith(
      'Action failed: Authorization: [REDACTED]'
    );
  });
});

describe('createLogger', () => {
  it('redacts common token and authorization formats before writing logs', () => {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const logger = createLogger();

    logger.info(
      'GITHUB_TOKEN=abc123 OPENAI_API_KEY=sk-test ANTHROPIC_API_KEY=anthropic-secret Authorization: Bearer xyz'
    );
    logger.error('Authorization: Bearer top-secret');

    expect(infoSpy).toHaveBeenCalledWith(
      'GITHUB_TOKEN=[REDACTED] OPENAI_API_KEY=[REDACTED] ANTHROPIC_API_KEY=[REDACTED] Authorization: [REDACTED]'
    );
    expect(errorSpy).toHaveBeenCalledWith('Authorization: [REDACTED]');

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
