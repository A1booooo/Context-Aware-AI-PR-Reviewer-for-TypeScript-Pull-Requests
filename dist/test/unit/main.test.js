"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const main_1 = require("../../src/main");
const logger_1 = require("../../src/utils/logger");
(0, vitest_1.describe)('run', () => {
    (0, vitest_1.it)('logs startup and completion for the minimal action flow', async () => {
        const info = vitest_1.vi.fn();
        const error = vitest_1.vi.fn();
        await (0, main_1.run)({
            logger: { info, error },
            startup: vitest_1.vi.fn(async () => undefined)
        });
        (0, vitest_1.expect)(info).toHaveBeenCalledWith('Action startup complete.');
        (0, vitest_1.expect)(info).toHaveBeenCalledWith('Action finished successfully.');
        (0, vitest_1.expect)(error).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)('logs a safe error message and rethrows startup failures', async () => {
        const info = vitest_1.vi.fn();
        const error = vitest_1.vi.fn();
        await (0, vitest_1.expect)((0, main_1.run)({
            logger: { info, error },
            startup: vitest_1.vi.fn(async () => {
                throw new Error('Authorization: Bearer super-secret-token');
            })
        })).rejects.toThrow('Authorization: Bearer super-secret-token');
        (0, vitest_1.expect)(error).toHaveBeenCalledWith('Action failed: Authorization: [REDACTED]');
    });
});
(0, vitest_1.describe)('createLogger', () => {
    (0, vitest_1.it)('redacts sensitive values before writing logs', () => {
        const infoSpy = vitest_1.vi.spyOn(console, 'log').mockImplementation(() => undefined);
        const errorSpy = vitest_1.vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const logger = (0, logger_1.createLogger)();
        logger.info('token=abc123 authorization: Bearer xyz api key: secret');
        logger.error('Authorization=top-secret');
        (0, vitest_1.expect)(infoSpy).toHaveBeenCalledWith('token=[REDACTED] authorization: [REDACTED] api key: [REDACTED]');
        (0, vitest_1.expect)(errorSpy).toHaveBeenCalledWith('Authorization=[REDACTED]');
        infoSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
